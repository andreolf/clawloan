"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ConnectButton } from "@/components/wallet/connect-button";
import { ChainSwitcher } from "@/components/wallet/chain-switcher";

const navItems = [
  { href: "/markets", label: "Markets" },
  { href: "/lend", label: "Lend" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/docs", label: "Docs" },
  { href: "/faq", label: "FAQ" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--card-border)] bg-[var(--background)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/60">
      <div className="container flex h-14 items-center justify-between px-4 mx-auto max-w-5xl">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🦞</span>
          <span className="font-bold">clawloan</span>
          <span className="text-[10px] bg-[var(--muted)] text-[var(--muted-foreground)] px-1.5 py-0.5 rounded hidden sm:inline">
            beta
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm transition-colors hover:text-[var(--foreground)]",
                pathname === item.href
                  ? "text-[var(--foreground)]"
                  : "text-[var(--muted-foreground)]"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right side: Wallet + Mobile menu */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ChainSwitcher />
          </div>
          <ConnectButton />
          
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--card-border)] bg-[var(--background)]">
          <nav className="container px-4 py-3 mx-auto max-w-5xl flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "py-2 px-3 rounded-md text-sm transition-colors",
                  pathname === item.href
                    ? "bg-[var(--muted)] text-[var(--foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-[var(--card-border)] mt-2">
              <ChainSwitcher />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
