/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: ['@meriter/shared-types'],
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    if (apiUrl && apiUrl.trim() !== '') {
      return [];
    }
    const isProduction = process.env.NODE_ENV === 'production';
    const apiHost = isProduction ? 'http://api:8002' : 'http://localhost:8002';
    return [
      { source: '/api/:path*', destination: `${apiHost}/api/:path*` },
      { source: '/trpc/community/:path*', destination: `${apiHost}/trpc/community/:path*` },
    ];
  },
};

module.exports = nextConfig;
