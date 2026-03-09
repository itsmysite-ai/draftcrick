import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@draftplay/ui",
    "@draftplay/shared",
    "tamagui",
    "@tamagui/core",
    "@tamagui/config",
  ],
};

export default nextConfig;
