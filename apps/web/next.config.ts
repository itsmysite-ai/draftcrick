import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  transpilePackages: [
    "@draftplay/ui",
    "@draftplay/shared",
    "tamagui",
    "@tamagui/core",
    "@tamagui/config",
  ],
};

export default nextConfig;
