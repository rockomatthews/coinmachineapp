"use client";

import { useState, useEffect, useContext } from 'react';
import { AppBar, Toolbar, IconButton, Button } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { Connection, PublicKey } from '@solana/web3.js';
import Sidebar from './Sidebar';
import { WalletContext } from '@/context/WalletContext';

export default function TopBar() {
  const { walletAddress, setWalletAddress } = useContext(WalletContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const connectWallet = async () => {
    if (window.solana && window.solana.isPhantom) {
      try {
        const response = await window.solana.connect();
        setWalletAddress(response.publicKey.toString());
      } catch (err) {
        console.error("Connection to Phantom wallet failed", err);
      }
    } else {
      alert("Phantom wallet not found! Please install it.");
    }
  };

  const truncateAddress = (address) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  useEffect(() => {
    if (window.solana && window.solana.isPhantom) {
      window.solana.connect({ onlyIfTrusted: true })
        .then(({ publicKey }) => setWalletAddress(publicKey.toString()))
        .catch(() => {});
    }
  }, [setWalletAddress]);

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
            onClick={connectWallet}
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