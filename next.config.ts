import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/vestigium",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
