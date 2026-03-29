import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "images.unsplash.com" },
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "lh3.googleusercontent.com" },
      { hostname: "pbs.twimg.com" },
      { hostname: "*.postsyncer.com" },
    ],
  },
  serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
