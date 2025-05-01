'use client';

import React, { useState, useEffect } from 'react';
import { Container, Box, CircularProgress, Typography } from '@mui/material';
import CoinInfo from '../../../components/CoinInfo';
import { Connection } from '@solana/web3.js';

export default function TokenPage() {
  const [connection, setConnection] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  
  useEffect(() => {
    // Initialize connection to Solana
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    if (rpcUrl) {
      const conn = new Connection(rpcUrl, 'confirmed');
      setConnection(conn);
    }
    setIsConnecting(false);
  }, []);
  
  if (isConnecting) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="300px">
          <CircularProgress size={40} />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Connecting to Solana network...
          </Typography>
        </Box>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <CoinInfo externalConnection={connection} />
    </Container>
  );
} 