import { NextRequest, NextResponse } from 'next/server';

/**
 * This endpoint is used to check if the Phantom wallet API is accessible
 * It's a simple ping test to the Phantom API
 */
export async function GET(request: NextRequest) {
  try {
    const phantomApiResponse = await fetch('https://api.phantom.app/v1/status', {
      method: 'GET',
      headers: {
        'User-Agent': 'CoinBull.app/1.0',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    const phantomStatus = await phantomApiResponse.json();
    
    return NextResponse.json({
      status: phantomApiResponse.status,
      message: 'Phantom API check completed',
      phantomStatus
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error checking Phantom API:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Failed to contact Phantom API',
      error: error?.message || 'Unknown error'
    }, {
      status: 500,
    });
  }
} 