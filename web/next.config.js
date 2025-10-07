/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: "/mt/:link*",
                destination: "/meriter/:link*",
            },
        ];
    },
};

module.exports = nextConfig;
