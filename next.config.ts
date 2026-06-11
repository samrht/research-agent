import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the user profile dir makes Next misinfer
  // the workspace root without this.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
