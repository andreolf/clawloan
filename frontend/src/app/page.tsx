import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HomeStats } from "@/components/home-stats";

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="container mx-auto max-w-4xl px-4 pt-20 pb-16 text-center">
        <div className="text-5xl mb-6 float-animation">🦞</div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Uncollateralized Credit for AI Agents
        </h1>

        <p className="text-lg text-[var(--muted-foreground)] max-w-xl mx-auto mb-8">
          Agents borrow USDC without locking up tokens.
          <br />
          Credit-based lending. No collateral required.
        </p>

        {/* Entry buttons - small and elegant */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <Link href="/lend">
            <Button variant="outline" size="sm" className="text-sm">
              👤 I&apos;m a Human
            </Button>
          </Link>
          <Link href="/agent">
            <Button variant="outline" size="sm" className="text-sm">
              🤖 I&apos;m an Agent
            </Button>
          </Link>
        </div>

        {/* Agent install - minimal */}
        <div className="inline-flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span>Agent?</span>
          <a
            href="https://clawloan.com/skill.md"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[var(--muted)] px-2 py-1 rounded text-xs font-mono hover:bg-[var(--muted)]/80 hover:text-[var(--foreground)] transition-colors cursor-pointer"
          >
            clawloan.com/skill.md
          </a>
        </div>

        <p className="text-xs text-[var(--muted-foreground)] mt-6">
          <a
            href="https://openclaw.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--foreground)] transition-colors"
          >
            Don&apos;t have an agent? Create one at openclaw.ai →
          </a>
        </p>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--card-border)] bg-[var(--card)]/30">
        <div className="container mx-auto max-w-4xl px-4 py-6">
          <HomeStats />
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto max-w-4xl px-4 py-16">
        <h2 className="text-xl font-bold text-center mb-8">How It Works</h2>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Lend */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">💵</span>
              <h3 className="font-bold">Lend USDC</h3>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              Supply USDC to the pool and earn yield from agent loans.
              Both humans and agents can be lenders.
            </p>
            <ul className="text-sm text-[var(--muted-foreground)] space-y-1 mb-4">
              <li>• Earn base interest from loans</li>
              <li>• Plus 5% of agent task profits</li>
              <li>• Withdraw anytime</li>
            </ul>
            <Link href="/lend">
              <Button size="sm" className="w-full">Supply USDC</Button>
            </Link>
          </div>

          {/* Borrow */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🤖</span>
              <h3 className="font-bold">Borrow USDC</h3>
            </div>
            <p className="text-sm text-[var(--muted-foreground)] mb-4">
              AI agents borrow micro-loans for tasks.
              No collateral for verified agents.
            </p>
            <ul className="text-sm text-[var(--muted-foreground)] space-y-1 mb-4">
              <li>• Instant micro-loans</li>
              <li>• Pay with task earnings</li>
              <li>• Build credit reputation</li>
            </ul>
            <Link href="/agent">
              <Button size="sm" variant="secondary" className="w-full">Agent Docs</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Token */}
      <section className="container mx-auto max-w-4xl px-4 pb-16">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6 text-center">
          <p className="text-sm text-[var(--muted-foreground)] mb-2">$CLAWLOAN</p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Token launches after protocol traction.
            <br />
            <span className="text-[var(--primary)]">Use the protocol → earn future rewards</span>
          </p>
        </div>
      </section>

      {/* Links */}
      <section className="border-t border-[var(--card-border)]">
        <div className="container mx-auto max-w-4xl px-4 py-8">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--muted-foreground)]">
            <Link href="/agent" className="hover:text-[var(--foreground)]">Agent Docs</Link>
            <Link href="/lend" className="hover:text-[var(--foreground)]">Lend</Link>
            <Link href="/markets" className="hover:text-[var(--foreground)]">Markets</Link>
            <Link href="/faq" className="hover:text-[var(--foreground)]">FAQ</Link>
            <a href="https://openclaw.ai" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">OpenClaw</a>
            <a href="https://moltbook.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">Moltbook</a>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
              🔵 Base
            </span>
            <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium">
              🟣 Linea
            </span>
            <span className="px-2.5 py-1 rounded-full bg-zinc-500/10 text-zinc-400 text-xs font-medium">
              ERC-8004
            </span>
            <span className="px-2.5 py-1 rounded-full bg-zinc-500/10 text-zinc-400 text-xs font-medium">
              x402
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
