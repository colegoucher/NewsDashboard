import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep these out of the bundler: jsdom pulls in dynamic requires, and
  // postgres manages its own connections.
  serverExternalPackages: ["jsdom", "@mozilla/readability", "postgres"],
};

export default nextConfig;
