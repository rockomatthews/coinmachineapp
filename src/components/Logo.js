import React from 'react';
import Image from 'next/image';
import { Box } from '@mui/material';

const Logo = ({ height = 500, className }) => {
  // The logo's natural dimensions (based on the original image)
  const naturalWidth = 800;
  const naturalHeight = 1024;
  
  // Calculate width while maintaining aspect ratio
  const width = Math.round((height * naturalWidth) / naturalHeight);

  return (
    <Box 
      className={className} 
      sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        position: 'relative',
        width: '100%',
        height: height
      }}
    >
      <Image
        src="/images/logo.png"
        alt="Coin Machine Logo"
        width={width}
        height={height}
        priority
        style={{
          objectFit: 'contain',
          maxHeight: '500px'
        }}
      />
    </Box>
  );
};

export default Logo; 