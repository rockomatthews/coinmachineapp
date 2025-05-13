"use client";

import { useState, useEffect, useContext } from 'react';
import { AppBar, Toolbar, IconButton, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Sidebar from './Sidebar';
import { WalletContext } from '@/context/WalletContext';

export default function TopBar() {
  const { walletAddress, connectWallet, disconnectWallet, isVerified } = useContext(WalletContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const truncateAddress = (address) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  const handleWalletClick = async () => {
    if (walletAddress) {
      await disconnectWallet();
    } else {
      await connectWallet();
    }
  };

  return (
    <>
      <AppBar 
        position="fixed"
        sx={{ 
          backgroundColor: 'black',
          color: 'white',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1200
        }}
      >
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={() => setSidebarOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          
          <Button 
            variant="contained" 
            onClick={handleWalletClick}
            sx={{ 
              marginLeft: 'auto',
              backgroundColor: '#FFD700',
              color: 'black',
              '&:hover': {
                backgroundColor: '#FFCD00'
              }
            }}
          >
            {walletAddress ? truncateAddress(walletAddress) : "Connect Wallet"}
          </Button>
        </Toolbar>
      </AppBar>
      
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
} 