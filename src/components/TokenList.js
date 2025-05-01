import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const TokenList = () => {
  const router = useRouter();

  const handleTokenClick = (tokenAddress) => {
    router.push(`/token/${tokenAddress}`);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Your Tokens
      </Typography>
      <Grid container spacing={2}>
        {tokens.map((token) => (
          <Grid item xs={12} sm={6} md={4} key={token.address}>
            <Paper 
              sx={{ 
                p: 2, 
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'action.hover',
                }
              }}
              onClick={() => handleTokenClick(token.address)}
            >
              <Box display="flex" alignItems="center" gap={2}>
                {token.logo && (
                  <Image
                    src={token.logo}
                    alt={token.name}
                    width={40}
                    height={40}
                    style={{ borderRadius: '4px' }}
                  />
                )}
                <Box>
                  <Typography variant="h6">{token.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {token.symbol}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default TokenList; 