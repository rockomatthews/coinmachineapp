/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
};

module.exports = nextConfig; 