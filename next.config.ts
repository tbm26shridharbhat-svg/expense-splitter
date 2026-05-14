import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin dev-resource requests by default. Allow access
  // from the local network IP so you can test the responsive design on a phone
  // (the case-study brief explicitly says judges will open the deployed link on
  // their phone — same standard applies during development).
  allowedDevOrigins: ["192.168.1.3", "localhost"],
};

export default nextConfig;
