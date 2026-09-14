/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Security: Disable "X-Powered-By: Next.js" header to prevent framework fingerprinting
};

export default nextConfig;
