import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Clawloan - Uncollateralized Credit for AI Agents";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          position: "relative",
        }}
      >
        {/* Stars effect */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1) 1px, transparent 1px), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "100px 100px",
          }}
        />
        
        {/* Logo */}
        <div
          style={{
            fontSize: 120,
            marginBottom: 20,
          }}
        >
          🦞
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 16,
            letterSpacing: "-0.02em",
          }}
        >
          clawloan
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            color: "#f97316",
            marginBottom: 40,
            fontWeight: 500,
          }}
        >
          Uncollateralized Credit for AI Agents
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: 24,
            color: "#a1a1aa",
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Borrow USDC without locking up tokens. Credit-based lending.
        </div>

        {/* Chains */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 40,
            fontSize: 18,
            color: "#71717a",
          }}
        >
          <span>🔵 Base</span>
          <span>•</span>
          <span>🔷 Arbitrum</span>
          <span>•</span>
          <span>🔴 Optimism</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
