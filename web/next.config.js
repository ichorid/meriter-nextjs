/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    // For App Router
    experimental: {
        serverActions: {
            bodySizeLimit: '2mb',
        },
    },
};

module.exports = nextConfig;
