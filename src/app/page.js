"use client";

import { Box, Typography, Button } from '@mui/material';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      textAlign: 'center',
      p: 3
    }}>
      <Typography variant="h2" gutterBottom>
        Welcome to The Coin Agency
      </Typography>
      <Typography variant="h5" gutterBottom sx={{ mb: 4 }}>
        Create, manage, and stake your memecoins with ease
      </Typography>

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button 
          variant="contained" 
          size="large"
          onClick={() => router.push('/create')}
          sx={{ 
            backgroundColor: 'limegreen',
            '&:hover': {
              backgroundColor: 'darkgreen'
            }
          }}
        >
          Create a Coin
        </Button>
        <Button 
          variant="contained" 
          size="large"
          onClick={() => router.push('/staking')}
          sx={{ 
            backgroundColor: 'limegreen',
            '&:hover': {
              backgroundColor: 'darkgreen'
            }
          }}
        >
          Staking
        </Button>
        <Button 
          variant="contained" 
          size="large"
          onClick={() => router.push('/manage')}
          sx={{ 
            backgroundColor: 'limegreen',
            '&:hover': {
              backgroundColor: 'darkgreen'
            }
          }}
        >
          Manage Coin
        </Button>
      </Box>
    </Box>
  );
}
