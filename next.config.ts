import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.publicatalogue.com",
        pathname: "/image/**",
      },
    ],
  },
};

export default nextConfig;
