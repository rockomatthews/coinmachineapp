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
          Recently Created Tokens
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
          Check out the latest tokens created by our community
        </Typography>
        <TokenWall />
      </Box>

      <Divider sx={{ my: 6 }} />

      <Box sx={{ mb: 6 }}>
        <Typography variant="h4" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
          Advanced Features
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
          For developers and experienced token creators
        </Typography>
        
        <Grid container spacing={4}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" component="h3" gutterBottom>
                Raydium Liquidity Pool Guide
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, flexGrow: 1 }}>
                Tokens are now automatically listed on DEXes! This guide explains the technical details of how our automatic Raydium liquidity pools work and what to do if you need to add more liquidity.
              </Typography>
              <Link href="/README-RAYDIUM.md" passHref>
                <Button variant="outlined" color="primary">
                  View Guide
                </Button>
              </Link>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" component="h3" gutterBottom>
                Token Utilities
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, flexGrow: 1 }}>
                Explore ways to add utility to your token, including governance features, staking rewards, and community engagement tools.
              </Typography>
              <Button variant="outlined" color="primary" disabled>
                Coming Soon
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
}
