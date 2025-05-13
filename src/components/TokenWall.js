"use client";

import { useState, useEffect } from 'react';
import { Box, Typography, Grid, Paper, Avatar, Skeleton, CircularProgress } from '@mui/material';
import { Connection, PublicKey } from '@solana/web3.js';

export default function TokenWall({ hideHeading = true }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Function to fetch tokens from localStorage
  useEffect(() => {
    try {
      setLoading(true);
      
      // Get tokens from localStorage (we'll need to save them there when creating)
      const savedTokens = localStorage.getItem('createdTokens');
      if (savedTokens) {
        const parsedTokens = JSON.parse(savedTokens);
        setTokens(parsedTokens);
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error fetching tokens:", error);
      setError("Failed to load tokens");
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress sx={{ color: 'lime' }} />
        <Typography sx={{ mt: 2, color: 'white' }}>Loading tokens...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      {tokens.length === 0 ? (
        <Typography sx={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
          No tokens have been created yet. Create your first token to see it here!
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {tokens.map((token, index) => (
            <Grid item xs={6} sm={4} md={3} lg={2} key={token.mintAddress || index}>
              <Paper 
                elevation={3}
                sx={{ 
                  p: 2, 
                  textAlign: 'center', 
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-5px)',
                    boxShadow: '0 8px 16px rgba(0, 200, 0, 0.3)'
                  }
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  {token.imageUri ? (
                    <Avatar 
                      src={token.imageUri} 
                      alt={token.symbol} 
                      sx={{ 
                        width: 80, 
                        height: 80, 
                        border: '2px solid #32CD32',
                        backgroundColor: 'black'
                      }}
                    />
                  ) : (
                    <Avatar 
                      sx={{ 
                        width: 80, 
                        height: 80, 
                        bgcolor: 'black',
                        border: '2px solid #32CD32',
                        color: 'lime',
                        fontSize: '24px'
                      }}
                    >
                      {token.symbol ? token.symbol.charAt(0) : '?'}
                    </Avatar>
                  )}
                </Box>
                <Typography variant="h6" sx={{ color: 'white', fontWeight: 'bold' }}>
                  {token.symbol}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                  {token.name}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
} 