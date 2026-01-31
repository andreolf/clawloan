"use client";

import { useEffect, useRef } from "react";

// Creates an animated favicon by drawing to canvas and updating the favicon link
export function AnimatedFavicon() {
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get or create favicon link
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    const animate = () => {
      frameRef.current += 0.05;
      const bounce = Math.sin(frameRef.current) * 2;
      const scale = 1 + Math.sin(frameRef.current * 2) * 0.05;

      // Clear
      ctx.clearRect(0, 0, 32, 32);

      // Background
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, 32, 32);

      // Animated circle (lobster color)
      ctx.save();
      ctx.translate(16, 16 + bounce);
      ctx.scale(scale, scale);
      
      // Gradient
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
      gradient.addColorStop(0, "#fb923c");
      gradient.addColorStop(1, "#ea580c");
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow effect
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 4;
      ctx.fill();
      
      ctx.restore();

      // Update favicon
      link.href = canvas.toDataURL("image/png");
    };

    const interval = setInterval(animate, 50); // 20fps

    return () => clearInterval(interval);
  }, []);

  return null;
}
