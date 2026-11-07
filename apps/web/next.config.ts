import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  // Allows browser tests to run beside a developer's existing Next server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  async headers() {
    return ["/visit/track", "/collaboration/track"].map(source => ({ source, headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] }));
  },
};

export default nextConfig;
