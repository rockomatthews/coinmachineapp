import { NextRequest, NextResponse } from 'next/server';

/**
 * IPFS proxy server to avoid CORS issues
 * This fetches IPFS content through our own server instead of directly from gateways
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Get the full IPFS path
  const ipfsPath = params.path.join('/');
  
  // Choose a reliable IPFS gateway
  const ipfsGatewayUrl = `https://dweb.link/ipfs/${ipfsPath}`;
  
  try {
    // Fetch the content from the IPFS gateway
    const response = await fetch(ipfsGatewayUrl, {
      headers: {
        'User-Agent': 'Coin Machine App/1.0',
      },
    });
    
    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    // Clone the response and pass it through
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
  } catch (error) {
    console.error('IPFS proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from IPFS' },
      { status: 500 }
    );
  }
} 