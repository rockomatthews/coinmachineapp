import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Link, CircularProgress, Alert } from '@mui/material';
import { useParams } from 'next/navigation';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getTokenMetadata, getTokenSupply, getTokenBalance } from '../utils/tokenUtils';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CoinInfo = () => {
  const { tokenAddress } = useParams();
  const { connection } = useConnection();
  const [tokenInfo, setTokenInfo] = useState(null);
  const [poolInfo, setPoolInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTokenInfo = async () => {
      try {
        setLoading(true);
        const tokenPubkey = new PublicKey(tokenAddress);
        
        // Fetch token metadata
        const metadata = await getTokenMetadata(connection, tokenPubkey);
        
        // Fetch token supply
        const supply = await getTokenSupply(connection, tokenPubkey);
        
        // Fetch pool information
        const pool = await getPoolInfo(connection, tokenPubkey);
        
        setTokenInfo({
          ...metadata,
          supply: supply.amount,
          decimals: supply.decimals
        });
        setPoolInfo(pool);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (tokenAddress) {
      fetchTokenInfo();
    }
  }, [tokenAddress, connection]);

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

  // Calculate bonding curve progression
  const calculateBondingCurveProgress = () => {
    if (!poolInfo) return null;
    
    const currentSupply = Number(tokenInfo.supply) / Math.pow(10, tokenInfo.decimals);
    const maxSupply = 1000000000; // Example max supply
    const progress = (currentSupply / maxSupply) * 100;
    
    return {
      progress,
      currentSupply,
      maxSupply
    };
  };

  const bondingCurveData = calculateBondingCurveProgress();

  // Prepare chart data for bonding curve
  const chartData = {
    labels: Array.from({ length: 100 }, (_, i) => i),
    datasets: [
      {
        label: 'Bonding Curve',
        data: Array.from({ length: 100 }, (_, i) => {
          const x = i / 100;
          return x * x * 100; // Quadratic bonding curve
        }),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'Current Position',
        data: Array(100).fill(bondingCurveData?.progress || 0),
        borderColor: 'rgb(255, 99, 132)',
        borderDash: [5, 5],
        tension: 0.1
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
        text: 'Bonding Curve Progression'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100
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
                <img 
                  src={tokenInfo.logo} 
                  alt={tokenInfo.name} 
                  style={{ width: 64, height: 64, borderRadius: '50%' }}
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
                {bondingCurveData?.currentSupply.toLocaleString()} / {bondingCurveData?.maxSupply.toLocaleString()}
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
            <Box mb={2}>
              <Typography variant="h4" color="primary">
                {bondingCurveData?.progress.toFixed(2)}%
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Progress along the bonding curve
              </Typography>
            </Box>
            <Box height={300}>
              <Line data={chartData} options={chartOptions} />
            </Box>
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
                      {poolInfo.address}
                    </Link>
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">Liquidity</Typography>
                  <Typography>{poolInfo.liquidity.toLocaleString()} SOL</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">Volume 24h</Typography>
                  <Typography>{poolInfo.volume24h.toLocaleString()} SOL</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="subtitle2" color="text.secondary">Price</Typography>
                  <Typography>{poolInfo.price.toFixed(6)} SOL</Typography>
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