"use client";

import { createContext, useState, useEffect, useCallback } from 'react';
import { detectPhantomWallet, formatWalletError, getPhantomInstallUrl } from '@/utils/walletUtils';
import { waitForPhantom, initializeWallet, connectWithDelay } from '@/utils/phantomInit';

// Define the Phantom wallet interface
export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [phantom, setPhantom] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  const [phantomReady, setPhantomReady] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [walletStatus, setWalletStatus] = useState({ isInstalled: false, isConnected: false });

  // Update the useEffect for wallet detection
  useEffect(() => {
    let mounted = true;
    
    // Use our improved initialization with proper error handling
    const initializePhantomWallet = async () => {
      try {
        // First wait for the wallet extension to be fully ready
        const phantom = await waitForPhantom(20); // Try up to 20 times
        
        if (!mounted) return;
        
        if (phantom) {
          setPhantom(phantom);
          setPhantomReady(true);
          
          // Check if we already have a connection
          try {
            if (phantom.isConnected && phantom.publicKey) {
              setWalletAddress(phantom.publicKey.toString());
              setIsVerified(true);
              
              // Set wallet status
              setWalletStatus({
                isInstalled: true,
                isConnected: true,
                message: 'Phantom wallet connected'
              });
            } else {
              // Just indicate the wallet is installed but not connected
              setWalletStatus({
                isInstalled: true,
                isConnected: false,
                message: 'Phantom wallet installed but not connected'
              });
            }
            
            // Add event listeners
            setupWalletListeners(phantom);
          } catch (err) {
            console.warn('Error during wallet initialization:', err);
            setLastError(formatWalletError(err));
          }
        } else {
          setWalletStatus({
            isInstalled: false,
            isConnected: false,
            message: 'Phantom wallet not detected'
          });
        }
      } catch (err) {
        if (!mounted) return;
        console.warn("Error initializing wallet:", err);
        setLastError(formatWalletError(err));
      }
    };
    
    // Start initialization
    initializePhantomWallet();
    
    // Cleanup function
    return () => {
      mounted = false;
      cleanupWalletListeners();
    };
  }, []);
  
  // Setup wallet event listeners with error handling
  const setupWalletListeners = useCallback((phantom) => {
    if (!phantom?.isPhantom) return;
    
    try {
      // Listen for account changes
      phantom.on('accountChanged', (publicKey) => {
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
      phantom.on('connect', (publicKey) => {
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
      
      phantom.on('disconnect', () => {
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
      if (phantom?.isPhantom) {
        phantom.removeAllListeners('accountChanged');
        phantom.removeAllListeners('connect');
        phantom.removeAllListeners('disconnect');
      }
    } catch (err) {
      console.warn('Error cleaning up wallet listeners:', err);
    }
  }, [phantom]);
  
  // And update the connectWallet function to use our new utility
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
      // Use our improved connection method that handles the timing issues
      const { wallet, publicKey, error } = await connectWithDelay();
      
      if (error) {
        setLastError(error);
        return null;
      }
      
      if (publicKey) {
        setWalletAddress(publicKey);
        setIsVerified(true);
        return publicKey;
      } else {
        setLastError('No response from Phantom wallet. Please check if Phantom is unlocked.');
        return null;
      }
    } catch (err) {
      console.error('Error connecting to wallet:', err);
      setLastError(formatWalletError(err));
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