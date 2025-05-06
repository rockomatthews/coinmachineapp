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
};

module.exports = nextConfig; 