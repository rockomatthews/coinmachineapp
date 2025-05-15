"use client";

import { Box, Typography, Button, Container, Divider, Grid, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';
import TokenWall from '@/components/TokenWall';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function HomePage() {
  const router = useRouter();

  // Random token data for the "Raging Tokens" section
  const ragingTokens = [
    { symbol: "RAGE", name: "RageCoin", imageUri: "/raging-token.png" },
    { symbol: "BULL", name: "BullRun", imageUri: "/bull-token.png" },
    { symbol: "FIRE", name: "FireToken", imageUri: "/fire-token.png" }
  ];

  return (
    <Container maxWidth="lg">
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Box sx={{ maxWidth: '400px', mx: 'auto', mb: 2 }}>
          <Logo height={200} />
        </Box>
        <Typography variant="h5" component="h2" sx={{ mb: 3, color: 'white' }}>
          CoinBull.app - Create and launch your own Solana token in minutes
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, color: '#FFD700', fontWeight: 'bold' }}>
          Now with automatic DEX listing! Your token will be tradable on Birdeye and other DEXes instantly.
        </Typography>
        <Button 
          variant="contained" 
          size="large" 
          onClick={() => router.push('/create')}
          sx={{ 
            fontSize: '1.2rem', 
            py: 1.5, 
            px: 4,
            backgroundColor: '#FFD700',
            color: 'black',
            '&:hover': {
              backgroundColor: '#FFCD00'
            }
          }}
        >
          Create New Token
        </Button>
      </Box>
      
      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
          🔥Raging Tokens🔥
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)' }}>
          Check out the latest tokens created by our community
        </Typography>
        <Grid container spacing={3}>
          {ragingTokens.map((token, index) => (
            <Grid item xs={6} sm={4} md={4} key={index}>
              <Paper 
                elevation={3}
                sx={{ 
                  p: 2, 
                  textAlign: 'center', 
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                  <Box 
                    sx={{ 
                      width: 80, 
                      height: 80, 
                      borderRadius: '50%',
                      backgroundColor: 'black',
                      border: '2px solid #FF4500',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '24px',
                      color: '#FF4500',
                      fontWeight: 'bold'
                    }}
                  >
                    {token.symbol.charAt(0)}
                  </Box>
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
      </Box>

      <Divider sx={{ my: 6 }} />

      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
          Recently Created Tokens
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', color: 'rgba(255, 255, 255, 0.8)' }}>
          See what others are building on Solana
        </Typography>
        <TokenWall />
      </Box>

      <Divider sx={{ my: 6 }} />

      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="body2" sx={{ color: '#FFD700', fontWeight: 'bold' }}>
          Coinbull 3030
        </Typography>
      </Box>
    </Container>
  );
}
