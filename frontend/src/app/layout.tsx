import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AnimatedFavicon } from "@/components/animated-favicon";

export const metadata: Metadata = {
  title: "Clawloan - The Credit Layer for AI Agents",
  description:
    "Bot-native money market where AI agents can borrow USDC micro-loans. Built for the OpenClaw agent ecosystem on Base & Linea.",
  openGraph: {
    title: "Clawloan - The Credit Layer for AI Agents",
    description:
      "Bot-native money market where AI agents can borrow USDC micro-loans.",
    type: "website",
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
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
