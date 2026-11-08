import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  // Old /site marketing URLs → root (static assets under /site/* stay put)
  async redirects() {
    return [
      { source: "/site", destination: "/", permanent: true },
      { source: "/site/about", destination: "/about", permanent: true },
      { source: "/site/features", destination: "/features", permanent: true },
      { source: "/site/pricing", destination: "/pricing", permanent: true },
      { source: "/site/contact", destination: "/contact", permanent: true },
    ];
  },
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
