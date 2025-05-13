/**
 * Utility to properly initialize Phantom wallet connection
 * Avoids the "Receiving end does not exist" error by implementing
 * proper initialization timing and detection
 */

/**
 * Wait for the Phantom wallet to be fully initialized
 * @param {number} maxAttempts - Maximum number of attempts
 * @param {number} interval - Interval between attempts in ms
 * @returns {Promise<object|null>} - The Phantom wallet object or null
 */
export const waitForPhantom = async (maxAttempts = 10, interval = 100) => {
  console.log("Waiting for Phantom wallet to initialize...");
  
  return new Promise(resolve => {
    let attempts = 0;
    
    // Check if Phantom is already available
    if (window?.solana?.isPhantom) {
      console.log("Phantom already available");
      return resolve(window.solana);
    }
    
    // Set up interval to check for Phantom
    const checkInterval = setInterval(() => {
      attempts++;
      
      // Check if Phantom is now available
      if (window?.solana?.isPhantom) {
        console.log(`Phantom found after ${attempts} attempts`);
        clearInterval(checkInterval);
        return resolve(window.solana);
      }
      
      // Stop checking after max attempts
      if (attempts >= maxAttempts) {
        console.log("Max attempts reached, Phantom not found");
        clearInterval(checkInterval);
        return resolve(null);
      }
    }, interval);
  });
};

/**
 * Initialize wallet connection with proper error handling
 * @returns {Promise<{wallet: object|null, error: string|null}>}
 */
export const initializeWallet = async () => {
  try {
    // Wait for Phantom to be available
    const phantom = await waitForPhantom();
    
    if (!phantom) {
      return { 
        wallet: null, 
        error: "Phantom wallet not detected. Please install Phantom." 
      };
    }
    
    // Safely check connection status
    let isConnected = false;
    try {
      isConnected = phantom.isConnected;
    } catch (e) {
      console.warn("Error checking connection status:", e);
    }
    
    if (isConnected) {
      try {
        // Already connected, just get the public key
        const publicKey = phantom.publicKey?.toString();
        if (publicKey) {
          return { wallet: phantom, publicKey, error: null };
        }
      } catch (e) {
        console.warn("Error getting public key from connected wallet:", e);
      }
    }
    
    // Attempt connection with proper error handling
    try {
      // Add a small delay before connecting to ensure Phantom is ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const response = await phantom.connect({ onlyIfTrusted: false });
      return { 
        wallet: phantom, 
        publicKey: response?.publicKey?.toString() || null,
        error: null
      };
    } catch (e) {
      // Check if user rejected
      if (e.message && (
        e.message.includes("User rejected") || 
        e.message.includes("rejected") ||
        e.message.includes("canceled") ||
        e.message.includes("cancelled")
      )) {
        return { wallet: phantom, error: "Connection was rejected by user." };
      }
      
      // Check for connection timing error
      if (e.message && e.message.includes("end does not exist")) {
        return { 
          wallet: phantom, 
          error: "Browser extension communication error. Please refresh the page." 
        };
      }
      
      // General connection error
      return { wallet: phantom, error: `Connection error: ${e.message}` };
    }
  } catch (e) {
    return { wallet: null, error: `Initialization error: ${e.message}` };
  }
};

/**
 * Safe method to check if Phantom is installed
 * Won't throw the "receiving end" error
 */
export const isPhantomInstalled = () => {
  try {
    return !!window?.solana?.isPhantom;
  } catch (e) {
    console.warn("Error checking if Phantom is installed:", e);
    return false;
  }
};

/**
 * Delayed connection that waits for wallet to be fully ready
 */
export const connectWithDelay = async () => {
  // First wait for Phantom to be initialized
  await waitForPhantom();
  
  // Then add extra delay to ensure message channels are ready
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Now try to connect
  return initializeWallet();
}; 