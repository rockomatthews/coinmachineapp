import { NextRequest, NextResponse } from 'next/server';
import { normalizeIpfsHash } from '@/utils/ipfsUtils';
// Import node-fetch for server-side fetching with better timeout controls
import fetch from 'node-fetch';

/**
 * IPFS proxy server to avoid CORS issues
 * This fetches IPFS content through our own server instead of directly from gateways
 * Uses multiple gateways with fallbacks for better reliability
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Get the full IPFS path
  const ipfsPath = params.path.join('/');
  
  // Add caching headers to avoid 504 timeouts
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000', // 1 year
  };
  
  // Special case - if we're retrieving metadata for token creation, serve an immediate response
  // This prevents token creation from hanging on IPFS timeouts
  const isMetadataRequired = request.headers.get('x-metadata-required') === 'true';
  const isMetadataFile = ipfsPath.endsWith('.json') || !ipfsPath.includes('.');
  
  if (isMetadataRequired && isMetadataFile) {
    // Return a valid metadata immediately to unblock the token creation process
    const immediateResponse = {
      name: "Metadata Processing",
      symbol: "TKN",
      description: "Token metadata is being processed. This is a temporary placeholder.",
      image: "", 
      properties: {
        files: []
      },
      attributes: []
    };
    
    console.log("Returning immediate response for IPFS metadata:", ipfsPath);
    
    // Trigger background fetch but don't wait for it
    try {
      // Use a non-blocking fetch to warm up the cache
      const bgFetchUrl = `${request.nextUrl.origin}/api/ipfs/${ipfsPath}`;
      fetch(bgFetchUrl, {
        headers: { 'x-background-fetch': 'true' },
        cache: 'no-store'
      }).catch(() => {});
    } catch (e) {
      // Ignore background fetch errors
    }
    
    return NextResponse.json(immediateResponse, { headers });
  }
  
  // A list of reliable IPFS gateways to try in order
  const ipfsGateways = [
    'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.filebase.io/ipfs/',
    'https://nftstorage.link/ipfs/',
    'https://w3s.link/ipfs/'
  ];
  
  // Set a shorter timeout for each fetch request (5 seconds)
  const fetchTimeout = 5000;
  
  // For background fetches, use a longer timeout
  const isBackgroundFetch = request.headers.get('x-background-fetch') === 'true';
  const actualTimeout = isBackgroundFetch ? 15000 : fetchTimeout;
  
  // Define result type for type safety
  type FetchResult = { 
    success: boolean; 
    response?: Response;
    gateway?: string;
  };
  
  // Try all gateways in parallel for faster response
  const fetchPromises = ipfsGateways.map(gateway => {
    const gatewayUrl = `${gateway}${ipfsPath}`;
    
    return new Promise<FetchResult>(async (resolve) => {
      try {
        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), actualTimeout);
        
        // Fetch with timeout
        const response = await fetch(gatewayUrl, {
          headers: {
            'User-Agent': 'CoinBull App/1.0',
          },
          signal: controller.signal,
          cache: 'no-store' // Bypass cache to avoid stale responses
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // If the response is successful
        if (response.ok) {
          resolve({ success: true, response, gateway });
        } else {
          resolve({ success: false, gateway });
        }
      } catch (error) {
        // Log the error but don't fail
        console.error(`IPFS proxy error with gateway ${gateway}:`, error);
        resolve({ success: false, gateway });
      }
    });
  });
  
  try {
    // Create a race between:
    // 1. The first successful response
    // 2. A timeout for all requests
    const overallTimeoutPromise = new Promise<FetchResult>(resolve => {
      // Overall timeout slightly longer than individual timeouts
      setTimeout(() => {
        resolve({ success: false });
      }, actualTimeout + 2000);
    });
    
    // Race between individual requests and overall timeout
    const results = await Promise.race([
      Promise.all(fetchPromises).then(results => results.find(r => r.success) || { success: false }),
      overallTimeoutPromise
    ]);
    
    if (results && 'success' in results && results.success) {
      const { response, gateway } = results as { success: true, response: Response, gateway?: string };
      
      // Get the content type from the response
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      
      console.log(`Successfully fetched IPFS content from gateway: ${gateway}`);
      
      // Get the data
      const data = await response.arrayBuffer();
      
      // Return the response with appropriate headers
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000', // 1 year
          'X-IPFS-Gateway': gateway || 'unknown'
        },
      });
    }
  } catch (error) {
    console.error("All IPFS gateway requests failed:", error);
  }
  
  // If all gateways failed and it's a metadata file, return a valid placeholder
  if (isMetadataFile) {
    console.log("Returning fallback metadata for IPFS path:", ipfsPath);
    return NextResponse.json(
      { 
        name: "Token Metadata", 
        symbol: "TKN",
        description: "Token created with CoinBull",
        image: "",
        properties: {
          files: []
        },
        attributes: [],
        fallback: true
      },
      { 
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        }
      }
    );
  }
  
  // If all gateways failed and it's not JSON, return an error
  return NextResponse.json(
    { error: 'Failed to fetch from all IPFS gateways' },
    { status: 502 }
  );
} 