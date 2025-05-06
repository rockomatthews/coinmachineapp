/**
 * Utilities for working with IPFS in a way that avoids CORS issues
 */

/**
 * Convert any IPFS URL to use our API proxy instead of direct gateway URLs
 * This avoids CORS issues in the browser
 */
export function getProxiedIpfsUrl(url: string): string {
  // Handle ipfs:// protocol URLs
  if (url.startsWith('ipfs://')) {
    const ipfsHash = url.replace('ipfs://', '');
    return `/api/ipfs/${ipfsHash}`;
  }
  
  // Handle various IPFS gateway URLs
  const ipfsGateways = [
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://ipfs.fleek.co/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.infura.io/ipfs/'
  ];
  
  for (const gateway of ipfsGateways) {
    if (url.includes(gateway)) {
      const ipfsHash = url.split(gateway)[1];
      return `/api/ipfs/${ipfsHash}`;
    }
  }
  
  // If it's already a /api/ipfs URL or not an IPFS URL, return as is
  return url;
}

/**
 * Replace all IPFS URLs in a string (like JSON) with our proxied URLs
 */
export function replaceIpfsUrlsInString(text: string): string {
  let result = text;
  
  // Handle ipfs:// protocol
  const ipfsProtocolRegex = /(ipfs:\/\/[^"'\s)]+)/g;
  result = result.replace(ipfsProtocolRegex, match => getProxiedIpfsUrl(match));
  
  // Handle gateway URLs
  const gatewayRegex = /(https:\/\/[^"'\s)]+\.ipfs\.[^"'\s)]+\/ipfs\/[^"'\s)]+)/g;
  result = result.replace(gatewayRegex, match => getProxiedIpfsUrl(match));
  
  return result;
} 