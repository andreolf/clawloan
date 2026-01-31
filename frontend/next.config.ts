import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/skill.md",
        destination: "/api/skill",
      },
      {
        source: "/heartbeat.md",
        destination: "/api/heartbeat",
      },
      {
        source: "/skill.json",
        destination: "/api/skill-json",
      },
    ];
  },
};

export default nextConfig;
