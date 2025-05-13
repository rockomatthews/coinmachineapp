/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ipfs.io',
        port: '',
        pathname: '/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: '*.ipfs.dweb.link',
        port: '',
        pathname: '/**',
      },
      // Allow images from our IPFS proxy
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'coinmachine.vercel.app',
        port: '',
        pathname: '/api/ipfs/**',
      },
      {
        protocol: 'https',
        hostname: 'coinbull.vercel.app',
        port: '',
        pathname: '/api/ipfs/**',
      },
      // For production domain or other domains you might use
      {
        protocol: 'https',
        hostname: '*.vercel.app',
        port: '',
        pathname: '/api/ipfs/**',
      }
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  webpack: (config, { isServer }) => {
    // Only apply in browser context (not server)
    if (!isServer) {
      // Ignore these Node.js modules when bundling for the browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
        process: false,
      };
    }
    return config;
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Add security headers for wallet connections
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
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
                https://*.vercel.app
                https://api.pinata.cloud;
              frame-src 'self' https://*.solana.com https://*.phantom.app;
              frame-ancestors 'self';
              form-action 'self';
              base-uri 'self';
              object-src 'none';
            `.replace(/\s+/g, ' ').trim()
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig; 