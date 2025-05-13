"use client";

import { createContext, useState, useEffect, useCallback } from 'react';

// Define the Phantom wallet interface
export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [phantom, setPhantom] = useState(null);
  const [isVerified, setIsVerified] = useState(false);

  // Set up wallet detection
  useEffect(() => {
    if (window?.solana?.isPhantom) {
      setPhantom(window.solana);
      
      // Check if already connected
      if (window.solana.isConnected) {
        try {
          setWalletAddress(window.solana.publicKey.toString());
          setIsVerified(true);
        } catch (err) {
          console.warn('Error getting connected wallet:', err);
        }
      }
      
      // Listen for account changes
      window.solana.on('accountChanged', (publicKey) => {
        if (publicKey) {
          setWalletAddress(publicKey.toString());
        } else {
          setWalletAddress(null);
          setIsVerified(false);
        }
      });
      
      // Listen for connect/disconnect
      window.solana.on('connect', (publicKey) => {
        setWalletAddress(publicKey.toString());
        setIsVerified(true);
      });
      
      window.solana.on('disconnect', () => {
        setWalletAddress(null);
        setIsVerified(false);
      });
    }
    
    return () => {
      // Clean up listeners
      if (window?.solana?.isPhantom) {
        window.solana.removeAllListeners('accountChanged');
        window.solana.removeAllListeners('connect');
        window.solana.removeAllListeners('disconnect');
      }
    };
  }, []);
  
  // Secure connect method
  const connectWallet = useCallback(async () => {
    if (!phantom) {
      window.open('https://phantom.app/', '_blank');
      return;
    }
    
    try {
      const resp = await phantom.connect({ onlyIfTrusted: false });
      setWalletAddress(resp.publicKey.toString());
      setIsVerified(true);
      return resp.publicKey.toString();
    } catch (err) {
      console.error('Error connecting to wallet:', err);
      return null;
    }
  }, [phantom]);
  
  // Disconnect method
  const disconnectWallet = useCallback(async () => {
    if (phantom) {
      try {
        await phantom.disconnect();
        setWalletAddress(null);
        setIsVerified(false);
      } catch (err) {
        console.error('Error disconnecting wallet:', err);
      }
    }
  }, [phantom]);

  return (
    <WalletContext.Provider value={{ 
      walletAddress, 
      setWalletAddress,
      connectWallet,
      disconnectWallet,
      isVerified,
      phantom
    }}>
      {children}
    </WalletContext.Provider>
  );
}; 