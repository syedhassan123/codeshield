import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Exam webcam recordings can be large (Phase 7).
      bodySizeLimit: "100mb",
    },
    // Server Actions POST to the page URL (e.g. /student/exam/session/[id]).
    // Next clones that POST for middleware with a 10MB default; raise to match
    // the Server Action limit so exam recordings are not truncated before upload.
    middlewareClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
