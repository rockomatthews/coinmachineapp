/**
 * Utility functions for wallet-related operations
 */

/**
 * Detect if Phantom wallet is installed
 * @returns {Object} Status object with isInstalled, isConnected and message
 */
export const detectPhantomWallet = () => {
  try {
    const isPhantomInstalled = window?.solana?.isPhantom || false;
    const isPhantomConnected = isPhantomInstalled && window.solana.isConnected;
    
    return {
      isInstalled: isPhantomInstalled,
      isConnected: isPhantomConnected,
      message: isPhantomInstalled 
        ? (isPhantomConnected ? 'Phantom wallet connected' : 'Phantom wallet installed but not connected') 
        : 'Phantom wallet not detected'
    };
  } catch (err) {
    console.error('Error detecting Phantom wallet:', err);
    return {
      isInstalled: false,
      isConnected: false,
      message: 'Error detecting Phantom wallet',
      error: err
    };
  }
};

/**
 * Check if browser has extension capabilities
 * @returns {boolean} Whether browser supports extensions
 */
export const browserSupportsExtensions = () => {
  try {
    // Chrome, Firefox, Edge, Opera
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      return true;
    }
    
    // Firefox specific
    if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.id) {
      return true;
    }
    
    // Safari specific
    if (typeof navigator !== 'undefined' && 
        navigator.userAgent.indexOf('Safari') !== -1 && 
        navigator.userAgent.indexOf('Chrome') === -1) {
      return true; // Safari supports extensions
    }
    
    return false;
  } catch (err) {
    console.error('Error checking browser extension support:', err);
    return false;
  }
};

/**
 * Format a user-friendly error message for wallet connection issues
 * @param {Error} error The error object
 * @returns {string} User-friendly error message
 */
export const formatWalletError = (error) => {
  if (!error) return 'Unknown wallet connection error';
  
  // Check for common error messages
  const errorMessage = error.message || '';
  
  if (errorMessage.includes('receiving end does not exist')) {
    return 'Cannot communicate with Phantom extension. Please refresh the page or restart your browser.';
  }
  
  if (errorMessage.includes('User rejected')) {
    return 'Connection request was rejected. Please try again.';
  }
  
  if (errorMessage.includes('timeout')) {
    return 'Connection timed out. Please try again.';
  }
  
  if (errorMessage.includes('already pending')) {
    return 'A wallet connection is already in progress. Please check your wallet extension.';
  }
  
  if (errorMessage.includes('Invalid public key')) {
    return 'Wallet returned an invalid address. Please try again.';
  }
  
  // Default generic message
  return `Wallet connection error: ${errorMessage}`;
};

/**
 * Get the URL to download Phantom wallet based on browser
 * @returns {string} Download URL for Phantom wallet
 */
export const getPhantomInstallUrl = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (userAgent.indexOf('firefox') > -1) {
    return 'https://addons.mozilla.org/en-US/firefox/addon/phantom-app/';
  }
  
  if (userAgent.indexOf('edg') > -1) {
    return 'https://microsoftedge.microsoft.com/addons/detail/phantom-wallet/glkineemhklmmcaigjkcpmimcmkdciim';
  }
  
  if (userAgent.indexOf('safari') > -1 && userAgent.indexOf('chrome') === -1) {
    return 'https://phantom.app/download'; // Safari
  }
  
  // Default to Chrome
  return 'https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa';
};

/**
 * Validate a Solana public key
 * @param {string} address - Wallet address to validate
 * @returns {boolean} Whether the address is a valid Solana public key
 */
export const isValidPublicKey = (address) => {
  if (!address) return false;
  
  try {
    if (typeof window !== 'undefined' && window.solana?.PublicKey) {
      // Use wallet's PublicKey constructor if available
      new window.solana.PublicKey(address);
      return true;
    } else {
      // Basic validation patterns
      // Base58 format check (Solana addresses are base58 encoded)
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }
  } catch (error) {
    console.warn('Public key validation error:', error);
    return false;
  }
};

/**
 * Get a safe PublicKey object or null
 * Prevents the "_bn" error by ensuring the key is valid before using it
 * @param {string} address - Wallet address to convert
 * @param {Object} solanaLib - Optional Solana web3.js library with PublicKey
 * @returns {Object|null} PublicKey object or null if invalid
 */
export const getSafePublicKey = (address, solanaLib = null) => {
  if (!address) return null;
  
  try {
    // Try using the provided library first
    if (solanaLib && solanaLib.PublicKey) {
      return new solanaLib.PublicKey(address);
    }
    
    // Then try window.solana.PublicKey if available
    if (typeof window !== 'undefined' && window.solana?.PublicKey) {
      return new window.solana.PublicKey(address);
    }
    
    // If no library is available, return null
    console.warn('No PublicKey constructor available');
    return null;
  } catch (error) {
    console.warn('Error creating PublicKey object:', error);
    return null;
  }
}; 