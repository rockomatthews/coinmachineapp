/**
 * IPFS Utility functions to improve reliability and performance of IPFS operations
 */

/**
 * Normalizes an IPFS hash or URI into a clean hash
 * @param {string} uriOrHash - IPFS URI or hash
 * @returns {string} - Clean IPFS hash without prefix
 */
export const normalizeIpfsHash = (uriOrHash) => {
  if (!uriOrHash) return '';
  
  // If it's already a clean hash without prefix
  if (uriOrHash.match(/^[a-zA-Z0-9]{46}$/)) {
    return uriOrHash;
  }
  
  // Handle ipfs:// protocol
  if (uriOrHash.startsWith('ipfs://')) {
    return uriOrHash.replace('ipfs://', '');
  }
  
  // Handle http/https URLs with /ipfs/ path
  if (uriOrHash.includes('/ipfs/')) {
    return uriOrHash.split('/ipfs/')[1].split('?')[0].split('#')[0];
  }
  
  // Return as is if we can't parse it
  return uriOrHash;
};

/**
 * Gets the best IPFS gateway URL for the given content
 * @param {string} ipfsHashOrUri - IPFS hash or URI
 * @param {Object} options - Options for generating the URL
 * @returns {string} - Full URL to access the content via a gateway
 */
export const getIpfsUrl = (ipfsHashOrUri, options = {}) => {
  const { 
    preferredGateway = 'ipfs.io',
    fallbackGateway = 'gateway.pinata.cloud',
    useDynamicGateway = true
  } = options;
  
  const hash = normalizeIpfsHash(ipfsHashOrUri);
  if (!hash) return '';
  
  // Use window location origin for dynamic gateway if available
  if (useDynamicGateway && typeof window !== 'undefined') {
    const origin = window.location.origin;
    return `${origin}/api/ipfs/${hash}`;
  }
  
  // Use preferred gateway
  return `https://${preferredGateway}/ipfs/${hash}`;
};

/**
 * Attempts to pre-fetch IPFS content to improve loading speed and reliability
 * @param {string} ipfsHashOrUri - IPFS hash or URI to prefetch
 * @returns {Promise<boolean>} - Whether prefetch was attempted (not necessarily successful)
 */
export const prefetchIpfsContent = async (ipfsHashOrUri) => {
  try {
    if (!ipfsHashOrUri || typeof window === 'undefined') return false;
    
    const hash = normalizeIpfsHash(ipfsHashOrUri);
    if (!hash) return false;
    
    const origin = window.location.origin;
    const proxyUrl = `${origin}/api/ipfs/${hash}`;
    
    // Use a non-blocking fetch to warm up the cache
    const fetchPromise = fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'x-background-fetch': 'true',
        'Cache-Control': 'no-cache'
      }
    }).catch(() => {});
    
    // Don't wait for the result
    setTimeout(() => {
      fetchPromise.catch(() => {});
    }, 0);
    
    return true;
  } catch (error) {
    console.warn('Error prefetching IPFS content:', error);
    return false;
  }
};

/**
 * Determines if a URI is from IPFS
 * @param {string} uri - URI to check
 * @returns {boolean} - Whether the URI is IPFS-based
 */
export const isIpfsUri = (uri) => {
  if (!uri) return false;
  return uri.startsWith('ipfs://') || uri.includes('/ipfs/');
};

export default {
  normalizeIpfsHash,
  getIpfsUrl,
  prefetchIpfsContent,
  isIpfsUri
}; 