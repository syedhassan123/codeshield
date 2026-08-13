import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Exam webcam recordings can be large (Phase 7).
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
