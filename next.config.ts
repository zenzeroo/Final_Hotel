import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow images from R2 public bucket and Google (for migration only)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-bd00e642ff7946b0b63fbec785554bf8.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
    formats: ["image/webp"],
  },
};

export default nextConfig;
