import { NextRequest, NextResponse } from 'next/server';

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
  
  // A list of reliable IPFS gateways to try in order
  const ipfsGateways = [
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.filebase.io/ipfs/'
  ];
  
  // Set a timeout for each fetch request (6 seconds)
  const fetchTimeout = 6000;
  
  // Try each gateway until one succeeds
  for (const gateway of ipfsGateways) {
    const gatewayUrl = `${gateway}${ipfsPath}`;
    
    try {
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);
      
      // Fetch with timeout
      const response = await fetch(gatewayUrl, {
        headers: {
          'User-Agent': 'CoinBull App/1.0',
        },
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // If the response is successful
      if (response.ok) {
        // Get the content type from the response
        const contentType = response.headers.get('content-type') || 'application/octet-stream';
        
        // Get the data
        const data = await response.arrayBuffer();
        
        // Return the response with appropriate headers
        return new NextResponse(data, {
          status: response.status,
          headers: {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=31536000', // 1 year
          },
        });
      }
    } catch (error) {
      // Log the error but continue to the next gateway
      console.error(`IPFS proxy error with gateway ${gateway}:`, error);
      // Continue to next gateway
    }
  }
  
  // If all gateways failed, return an error
  return NextResponse.json(
    { error: 'Failed to fetch from all IPFS gateways' },
    { status: 502 }
  );
} 