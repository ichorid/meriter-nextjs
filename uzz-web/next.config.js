/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  typescript: {
    ignoreBuildErrors: process.env.DOCKER_BUILD === 'true',
  },
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  output: process.env.PLAYWRIGHT_TEST === 'true' ? undefined : 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  transpilePackages: ['@meriter/shared-types'],
  async rewrites() {
    const configured = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
    const isProduction = process.env.NODE_ENV === 'production';
    const apiHost = configured || (isProduction ? 'http://api:8002' : 'http://127.0.0.1:8002');
    return [
      { source: '/api/:path*', destination: `${apiHost}/api/:path*` },
      { source: '/trpc/uzz/:path*', destination: `${apiHost}/trpc/uzz/:path*` },
    ];
  },
};

module.exports = nextConfig;
