import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      {
        source: "/hours",
        destination: "/#hours",
        permanent: false,
      },
      {
        source: "/hours-and-location",
        destination: "/#hours",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
