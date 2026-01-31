import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/skill.md",
        destination: "/api/skill",
      },
    ];
  },
};

export default nextConfig;
