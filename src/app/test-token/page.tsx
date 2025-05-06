'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Box, 
  Button, 
  Typography, 
  Container, 
  Paper, 
  CircularProgress,
  TextField,
  Alert
} from '@mui/material';

// Define types for Phantom wallet
declare global {
  interface Window {
    solana?: {
      isPhantom: boolean;
      isConnected: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      publicKey: { toString: () => string };
    };
  }
}

export default function TestTokenPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenParams, setTokenParams] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    // Try to get wallet address from Phantom or other connected wallet
    const checkWallet = async () => {
      try {
        if (window.solana && window.solana.isPhantom && window.solana.isConnected) {
          const address = window.solana.publicKey.toString();
          setWalletAddress(address);
        }
      } catch (err: any) {
        console.warn('Error getting wallet address:', err?.message);
      }
    };

    checkWallet();
  }, []);

  const connectWallet = async () => {
    try {
      if (window.solana && window.solana.isPhantom) {
        await window.solana.connect();
        setWalletAddress(window.solana.publicKey.toString());
      } else {
        setError('Phantom wallet not found. Please install Phantom wallet extension.');
      }
    } catch (err: any) {
      setError('Failed to connect wallet: ' + (err?.message || 'Unknown error'));
    }
  };

  const generateTestToken = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/test-create-token?wallet=${encodeURIComponent(walletAddress)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate test token params');
      }

      setTokenParams(data.testToken);
    } catch (err: any) {
      setError('Error: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const goToCreateCoin = () => {
    if (!tokenParams) return;

    // Store the parameters in localStorage to pre-fill the form
    localStorage.setItem('testTokenParams', JSON.stringify(tokenParams));
    
    // Navigate to the create coin page
    router.push('/create');
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper sx={{ p: 4, bgcolor: 'black', color: 'white', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)' }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ color: 'lime' }}>
          Test Token Creator
        </Typography>
        
        <Typography variant="body1" paragraph>
          This tool helps you quickly test the token creation process without manually filling in the form each time.
        </Typography>

        {!walletAddress ? (
          <Button 
            variant="contained" 
            onClick={connectWallet}
            sx={{ 
              bgcolor: 'lime', 
              color: 'black', 
              '&:hover': { bgcolor: '#c0ff00' },
              mb: 3 
            }}
          >
            Connect Wallet
          </Button>
        ) : (
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2">
              Connected Wallet: {walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3, bgcolor: 'rgba(211, 47, 47, 0.1)' }}>
            {error}
          </Alert>
        )}

        <Button 
          variant="contained" 
          onClick={generateTestToken}
          disabled={!walletAddress || loading}
          sx={{ 
            bgcolor: 'lime', 
            color: 'black', 
            '&:hover': { bgcolor: '#c0ff00' },
            mb: 3 
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Generate Test Token Parameters'}
        </Button>

        {tokenParams && (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" sx={{ color: 'lime', mb: 2 }}>
              Test Token Parameters
            </Typography>
            
            <Paper sx={{ p: 2, bgcolor: 'rgba(255, 255, 255, 0.05)', mb: 3 }}>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                <strong>Name:</strong> {tokenParams.name}
              </Typography>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                <strong>Symbol:</strong> {tokenParams.symbol}
              </Typography>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                <strong>Total Supply:</strong> {tokenParams.supply.toLocaleString()}
              </Typography>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                <strong>Creator Retention:</strong> {tokenParams.creatorRetention.toLocaleString()} ({(tokenParams.creatorRetention / tokenParams.supply * 100).toFixed(1)}%)
              </Typography>
              <Typography variant="body2" component="div" sx={{ mb: 1 }}>
                <strong>Bonding Curve Supply:</strong> {tokenParams.bondingCurveSupply.toLocaleString()} ({(tokenParams.bondingCurveSupply / tokenParams.supply * 100).toFixed(1)}%)
              </Typography>
            </Paper>

            <Button 
              variant="contained" 
              onClick={goToCreateCoin}
              sx={{ 
                bgcolor: 'lime', 
                color: 'black', 
                '&:hover': { bgcolor: '#c0ff00' }
              }}
            >
              Continue to Create Coin Form
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
} 