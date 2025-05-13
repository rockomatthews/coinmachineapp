import { NextRequest, NextResponse } from 'next/server';

/**
 * This endpoint is used by Phantom wallet to verify that the site is legitimate.
 * It provides specific information that Phantom uses to determine if the site is safe.
 */
export async function GET(request: NextRequest) {
  const appInfo = {
    name: "CoinBull.app",
    description: "Create and launch your own Solana token in minutes",
    icon: "https://www.coinbull.app/images/logo.png",
    version: "1.0.0",
    website: "https://www.coinbull.app",
    verified: true,
    requested_permissions: [
      "connect",
      "sign_transaction",
      "sign_message"
    ],
    required_permissions: [
      "connect", 
      "sign_transaction"
    ],
    security_contact: "security@coinbull.app"
  };

  return NextResponse.json(appInfo, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'https://phantom.app',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'public, max-age=86400' // 24 hours
    },
  });
} 