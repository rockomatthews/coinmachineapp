"use client";

import { useState, useEffect, useContext } from 'react';
import { AppBar, Toolbar, IconButton, Button, Snackbar, Alert, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Sidebar from './Sidebar';
import { WalletContext } from '@/context/WalletContext';

export default function TopBar() {
  const { 
    walletAddress, 
    connectWallet, 
    disconnectWallet, 
    isVerified, 
    phantomReady,
    lastError,
    clearError,
    walletStatus
  } = useContext(WalletContext);
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localError, setLocalError] = useState(null);

  // Use either local or context error
  const error = lastError || localError;

  const truncateAddress = (address) => `${address.slice(0, 4)}...${address.slice(-4)}`;

  const handleWalletClick = async () => {
    if (walletAddress) {
      await disconnectWallet();
    } else {
      setIsConnecting(true);
      try {
        const address = await connectWallet();
        if (!address) {
          setLocalError("Wallet connection failed. Please try again or refresh the page.");
        }
      } catch (err) {
        console.error("Wallet connection error:", err);
        setLocalError("Wallet connection error. Please try again or refresh the page.");
      } finally {
        setIsConnecting(false);
      }
    }
  };

  const handleCloseError = () => {
    setLocalError(null);
    clearError();
  };

  // Display appropriate wallet button text
  const getWalletButtonText = () => {
    if (isConnecting) return "Connecting...";
    if (walletAddress) return truncateAddress(walletAddress);
    if (!walletStatus.isInstalled) return "Install Phantom";
    return "Connect Wallet";
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
          
          <Tooltip title={walletStatus.isInstalled ? "Connect to your Phantom wallet" : "Install Phantom wallet"}>
            <Button 
              variant="contained" 
              onClick={handleWalletClick}
              disabled={isConnecting}
              sx={{ 
                marginLeft: 'auto',
                backgroundColor: '#FFD700',
                color: 'black',
                '&:hover': {
                  backgroundColor: '#FFCD00'
                }
              }}
            >
              {getWalletButtonText()}
            </Button>
          </Tooltip>
        </Toolbar>
      </AppBar>
      
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <Snackbar 
        open={!!error} 
        autoHideDuration={6000} 
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseError} 
          severity="error" 
          sx={{ width: '100%', maxWidth: '600px' }}
        >
          {error}
        </Alert>
      </Snackbar>
    </>
  );
} 