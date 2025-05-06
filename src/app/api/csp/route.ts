import { NextRequest, NextResponse } from 'next/server';

/**
 * This route handles CSP (Content Security Policy) header generation
 * To make the app more secure for wallet integrations
 */
export function GET(request: NextRequest) {
  // Create a policy that allows wallet connections but remains secure
  const csp = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob: https: http:;
    font-src 'self';
    worker-src 'self' blob:;
    connect-src 'self' 
      https://*.solana.com
      https://*.neon.tech
      https://*.rpc.ankr.com
      https://*.quiknode.pro
      wss://*.quiknode.pro
      wss://*.solana.com
      https://api.mainnet-beta.solana.com
      https://dweb.link
      https://*.ipfs.io
      https://*.fleek.co
      https://gateway.ipfs.io
      https://cloudflare-ipfs.com
      https://solflare.com
      https://*.phantom.app
      ws://*.phantom.app
      wss://*.phantom.app
      https://*.vercel.app;
    frame-src 'self' https://*.solana.com https://*.phantom.app;
    frame-ancestors 'self';
    form-action 'self';
    base-uri 'self';
    object-src 'none';
  `.replace(/\s+/g, ' ').trim();

  return new NextResponse(JSON.stringify({ csp }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Security-Policy': csp,
    },
  });
} 