import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets pilot PCs on the office LAN load this dev server directly by IP
  // (e.g. testing the agent/dashboard from a colleague's machine) instead
  // of only localhost — Next.js 16 blocks cross-origin dev resources by
  // default for safety.
  allowedDevOrigins: ["192.168.0.188"],
};

export default nextConfig;
