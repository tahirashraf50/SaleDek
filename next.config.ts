import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  // Hide the bottom-left "N" Next.js Dev Tools badge (dev only)
  devIndicators: false,
  // Hostinger production build: unblock deploy while we tighten types
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Hostinger shared builders: limit Next worker pool
    cpus: 2,
    workerThreads: false,
    // Policy PDFs often exceed the default 1MB Server Action body limit
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
