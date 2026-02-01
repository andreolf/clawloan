import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AnimatedFavicon } from "@/components/animated-favicon";
import { StarryBackground } from "@/components/starry-background";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Clawloan - The Credit Layer for AI Agents",
  description:
    "Uncollateralized DeFi lending for AI agents. Borrow USDC micro-loans without locking up tokens. Credit-based lending built on ERC-8004.",
  keywords: ["AI agents", "DeFi", "lending", "USDC", "Base", "uncollateralized", "micro-loans", "credit", "ERC-8004"],
  openGraph: {
    title: "Clawloan",
    description: "Uncollateralized credit for AI agents. No collateral, just reputation.",
    type: "website",
    siteName: "Clawloan",
    url: "https://clawloan.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clawloan - The Credit Layer for AI Agents",
    description: "Uncollateralized credit for AI agents. No collateral, just reputation.",
    creator: "@francescoswiss",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <Providers>
          <AnimatedFavicon />
          <StarryBackground />
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
