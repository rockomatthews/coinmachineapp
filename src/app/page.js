"use client";

import { Box, Typography, Button, Container, Divider, Grid, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';
import TokenWall from '@/components/TokenWall';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function HomePage() {
  const router = useRouter();

  return (
    <Container maxWidth="lg">
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Box sx={{ maxWidth: '400px', mx: 'auto', mb: 2 }}>
          <Logo height={200} />
        </Box>
        <Typography variant="h5" component="h2" sx={{ mb: 3, color: 'text.secondary' }}>
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
        <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
          Check out the latest tokens created by our community
        </Typography>
        <TokenWall />
      </Box>

      <Divider sx={{ my: 6 }} />

      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
          Recently Created Tokens
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
          See what others are building on Solana
        </Typography>
        <TokenWall />
      </Box>

      <Divider sx={{ my: 6 }} />

      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Coinbull 3030
        </Typography>
      </Box>
    </Container>
  );
}
