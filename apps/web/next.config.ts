import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@draftcrick/ui",
    "@draftcrick/shared",
    "tamagui",
    "@tamagui/core",
    "@tamagui/config",
  ],
};

export default nextConfig;
