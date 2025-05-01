import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Link, CircularProgress, Alert, LinearProgress } from '@mui/material';
import { useParams } from 'next/navigation';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Connection } from '@solana/web3.js';
import { getTokenMetadata, getTokenSupply, getTokenBalance, calculateBondingCurveProgress } from '../utils/tokenUtils';
import { getPoolInfo } from '../utils/raydiumPool';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import Image from 'next/image';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CoinInfo = ({ externalConnection }) => {
  const { tokenAddress } = useParams();
  const walletConnection = useConnection()?.connection;
  const [tokenInfo, setTokenInfo] = useState(null);
  const [poolInfo, setPoolInfo] = useState(null);
  const [bondingCurveInfo, setBondingCurveInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Use external connection if provided, otherwise fall back to wallet connection
  const connection = externalConnection || walletConnection;

  useEffect(() => {
    const fetchTokenInfo = async () => {
      try {
        setLoading(true);
        
        if (!connection) {
          console.warn("No connection available in CoinInfo. Creating a fallback connection.");
          // Create a fallback connection if needed
          const fallbackConnection = new Connection(
            process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
            'confirmed'
          );
          
          await fetchTokenData(fallbackConnection);
        } else {
          await fetchTokenData(connection);
        }
      } catch (err) {
        console.error("Error fetching token info:", err);
        setError(err.message || "Failed to load token information");
      } finally {
        setLoading(false);
      }
    };
    
    // Helper function to fetch token data with a given connection
    const fetchTokenData = async (conn) => {
      try {
        const tokenPubkey = new PublicKey(tokenAddress);
        
        // Fetch token metadata
        const metadata = await getTokenMetadata(conn, tokenPubkey);
        
        // Fetch token supply
        const supply = await getTokenSupply(conn, tokenPubkey);
        
        // Fetch pool information
        const pool = await getPoolInfo(conn, tokenPubkey);
        
        setTokenInfo({
          ...metadata,
          supply: supply.amount,
          decimals: supply.decimals
        });
        setPoolInfo(pool);
        
        // Calculate bonding curve information
        const totalSupply = Number(supply.amount);
        // Assume 20% retention as default if not available
        const retentionPercentage = 20;
        const reservedTokens = totalSupply * (retentionPercentage / 100);
        
        const progress = calculateBondingCurveProgress(
          totalSupply,
          reservedTokens,
          pool.baseTokenBalance || 0
        );
        
        setBondingCurveInfo({
          progress,
          totalSupply,
          reservedTokens,
          poolBalance: pool.baseTokenBalance || 0,
          retentionPercentage
        });
      } catch (dataError) {
        console.warn("Error in fetchTokenData:", dataError);
        throw dataError;
      }
    };

    if (tokenAddress) {
      fetchTokenInfo();
    }
  }, [tokenAddress, connection, externalConnection]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!tokenInfo) {
    return (
      <Box p={3}>
        <Alert severity="warning">Token information not found</Alert>
      </Box>
    );
  }

  // Prepare chart data for bonding curve
  const chartData = {
    labels: Array.from({ length: 20 }, (_, i) => i * 5), // 0%, 5%, 10%, ... 100%
    datasets: [
      {
        label: 'Bonding Curve Price',
        data: Array.from({ length: 20 }, (_, i) => {
          const x = i / 19; // 0 to 1
          // Quadratic curve: price increases as square of progress
          return x * x * 0.0001; 
        }),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.3
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Bonding Curve Price Progression'
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            return `Price: ${context.raw.toFixed(8)} SOL`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Price (SOL)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Progress (%)'
        }
      }
    }
  };

  return (
    <Box p={3}>
      <Grid container spacing={3}>
        {/* Token Header */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" gap={2}>
              {tokenInfo.logo && (
                <Image
                  src={tokenInfo.logo}
                  alt={tokenInfo.name}
                  width={64}
                  height={64}
                  style={{ borderRadius: '50%' }}
                />
              )}
              <Box>
                <Typography variant="h4">{tokenInfo.name}</Typography>
                <Typography variant="subtitle1" color="text.secondary">
                  {tokenInfo.symbol}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Token Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Token Information</Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <Typography>
                <strong>Address:</strong>{' '}
                <Link 
                  href={`https://solscan.io/token/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {tokenAddress}
                </Link>
              </Typography>
              <Typography>
                <strong>Supply:</strong>{' '}
                {Number(tokenInfo.supply) / Math.pow(10, tokenInfo.decimals || 9)}
              </Typography>
              <Typography>
                <strong>Decimals:</strong> {tokenInfo.decimals}
              </Typography>
              <Typography>
                <strong>Birdeye:</strong>{' '}
                <Link 
                  href={`https://birdeye.so/token/${tokenAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on Birdeye
                </Link>
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Bonding Curve Progress */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Bonding Curve Progress</Typography>
            {bondingCurveInfo ? (
              <>
                <Box mb={2}>
                  <Typography variant="h4" color="primary">
                    {bondingCurveInfo.progress.toFixed(2)}%
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={bondingCurveInfo.progress} 
                    sx={{ height: 10, my: 1, borderRadius: 5 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Creator Retention: {bondingCurveInfo.retentionPercentage}% ({
                      Number(bondingCurveInfo.reservedTokens / Math.pow(10, tokenInfo.decimals || 9)).toLocaleString()
                    } tokens)
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pool Balance: {
                      Number(bondingCurveInfo.poolBalance / Math.pow(10, tokenInfo.decimals || 9)).toLocaleString()
                    } tokens
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 1 }}>
                    {bondingCurveInfo.progress >= 95 
                      ? "🎉 This token is about to graduate!" 
                      : `${(95 - bondingCurveInfo.progress).toFixed(2)}% more to graduation`
                    }
                  </Typography>
                </Box>
                <Box height={250}>
                  <Line data={chartData} options={chartOptions} />
                </Box>
              </>
            ) : (
              <Typography color="text.secondary">
                Bonding curve information not available
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Pool Information */}
        {poolInfo && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Pool Information</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">Pool Address</Typography>
                  <Typography>
                    <Link 
                      href={`https://solscan.io/account/${poolInfo.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {poolInfo.address?.substring(0, 8)}...{poolInfo.address?.substring(poolInfo.address.length - 8)}
                    </Link>
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">Liquidity</Typography>
                  <Typography>{poolInfo.liquidity?.toLocaleString() || 0} SOL</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">Volume 24h</Typography>
                  <Typography>{poolInfo.volume24h?.toLocaleString() || 0} SOL</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">Price</Typography>
                  <Typography>{poolInfo.price?.toFixed(8) || 0} SOL</Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default CoinInfo; 