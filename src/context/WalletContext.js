"use client";

import { createContext, useState, useEffect, useCallback } from 'react';
import { detectPhantomWallet, formatWalletError, getPhantomInstallUrl } from '@/utils/walletUtils';

// Define the Phantom wallet interface
export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [phantom, setPhantom] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [phantomReady, setPhantomReady] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [walletStatus, setWalletStatus] = useState({ isInstalled: false, isConnected: false });

  // Set up wallet detection with improved error handling
  useEffect(() => {
    const checkWalletInterval = setInterval(() => {
      try {
        // Use the utility function to detect Phantom
        const status = detectPhantomWallet();
        setWalletStatus(status);
        
        if (status.isInstalled && !phantom) {
          console.log("Phantom wallet detected");
          setPhantom(window.solana);
          setPhantomReady(true);
          clearInterval(checkWalletInterval);
          
          // Check if already connected
          if (status.isConnected) {
            try {
              if (window.solana.publicKey) {
                setWalletAddress(window.solana.publicKey.toString());
                setIsVerified(true);
              }
            } catch (err) {
              console.warn('Error getting connected wallet:', err);
              setLastError(formatWalletError(err));
            }
          }
          
          // Add event listeners
          setupWalletListeners();
        }
      } catch (err) {
        console.warn("Error checking for Phantom wallet:", err);
        setLastError(formatWalletError(err));
      }
    }, 500);
    
    // Clear interval after 10 seconds to avoid running indefinitely
    setTimeout(() => {
      clearInterval(checkWalletInterval);
    }, 10000);
    
    return () => {
      clearInterval(checkWalletInterval);
      cleanupWalletListeners();
    };
  }, [phantom]);
  
  // Setup wallet event listeners with error handling
  const setupWalletListeners = useCallback(() => {
    if (!window?.solana?.isPhantom) return;
    
    try {
      // Listen for account changes
      window.solana.on('accountChanged', (publicKey) => {
        try {
          if (publicKey) {
            setWalletAddress(publicKey.toString());
          } else {
            setWalletAddress(null);
            setIsVerified(false);
          }
        } catch (err) {
          console.warn('Error handling account change:', err);
          setLastError(formatWalletError(err));
        }
      });
      
      // Listen for connect/disconnect
      window.solana.on('connect', (publicKey) => {
        try {
          if (publicKey) {
            setWalletAddress(publicKey.toString());
            setIsVerified(true);
          }
        } catch (err) {
          console.warn('Error handling connect:', err);
          setLastError(formatWalletError(err));
        }
      });
      
      window.solana.on('disconnect', () => {
        try {
          setWalletAddress(null);
          setIsVerified(false);
        } catch (err) {
          console.warn('Error handling disconnect:', err);
          setLastError(formatWalletError(err));
        }
      });
    } catch (err) {
      console.warn('Error setting up wallet listeners:', err);
      setLastError(formatWalletError(err));
    }
  }, []);
  
  // Cleanup function for wallet listeners
  const cleanupWalletListeners = useCallback(() => {
    try {
      if (window?.solana?.isPhantom) {
        window.solana.removeAllListeners('accountChanged');
        window.solana.removeAllListeners('connect');
        window.solana.removeAllListeners('disconnect');
      }
    } catch (err) {
      console.warn('Error cleaning up wallet listeners:', err);
    }
  }, []);
  
  // Secure connect method with better error handling
  const connectWallet = useCallback(async () => {
    // Clear previous errors
    setLastError(null);
    
    if (!phantomReady) {
      const installUrl = getPhantomInstallUrl();
      window.open(installUrl, '_blank');
      setLastError('Phantom wallet not detected. Please install it and refresh the page.');
      return null;
    }
    
    try {
      // Use try-catch around each potential error point
      if (!phantom) {
        console.warn("Phantom not initialized");
        setLastError('Phantom wallet not initialized. Please refresh the page.');
        return null;
      }
      
      // Add extra delay to ensure Phantom is ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Connect with error handling
      const resp = await phantom.connect({ onlyIfTrusted: false }).catch(err => {
        console.error('Phantom connect error:', err);
        setLastError(formatWalletError(err));
        return null;
      });
      
      if (!resp || !resp.publicKey) {
        console.warn("No response from Phantom wallet");
        setLastError('No response from Phantom wallet. Please check if Phantom is unlocked.');
        return null;
      }
      
      setWalletAddress(resp.publicKey.toString());
      setIsVerified(true);
      return resp.publicKey.toString();
    } catch (err) {
      console.error('Error connecting to wallet:', err);
      
      // Use utility to format error message
      const errorMessage = formatWalletError(err);
      setLastError(errorMessage);
      
      return null;
    }
  }, [phantom, phantomReady]);
  
  // Disconnect method with error handling
  const disconnectWallet = useCallback(async () => {
    if (!phantom) return;
    
    try {
      await phantom.disconnect().catch(err => {
        console.warn("Error during disconnect:", err);
        setLastError(formatWalletError(err));
      });
      
      setWalletAddress(null);
      setIsVerified(false);
    } catch (err) {
      console.error('Error disconnecting wallet:', err);
      setLastError(formatWalletError(err));
    }
  }, [phantom]);

  return (
    <WalletContext.Provider value={{ 
      walletAddress,
      setWalletAddress,
      connectWallet,
      disconnectWallet,
      isVerified,
      phantom,
      phantomReady,
      lastError,
      walletStatus,
      clearError: () => setLastError(null)
    }}>
      {children}
    </WalletContext.Provider>
  );
}; 