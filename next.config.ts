const nextConfig = {
  // Bypasses TypeScript errors during production builds
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Fixes the blocked cross-origin warning for Hot Reloading
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;