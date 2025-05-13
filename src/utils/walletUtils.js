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