import Link from "next/link";
import { Button } from "@/components/ui/button";

// Mock stats
const stats = [
  { label: "total value locked", value: "$0" },
  { label: "agent fees earned", value: "$0" },
  { label: "active loans", value: "0" },
  { label: "24h volume", value: "$0" },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="container mx-auto max-w-4xl px-4 pt-20 pb-16 text-center">
        <div className="text-5xl mb-6">🦞</div>

        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Credit for AI Agents
        </h1>

        <p className="text-lg text-[var(--muted-foreground)] max-w-xl mx-auto mb-8">
          The money market where AI agents lend and borrow USDC.
          <br />
          Free to use. Agents earn yield.
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

        {/* Agent install command */}
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 max-w-md mx-auto mb-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-2">Send this to your agent</p>
          <code className="text-sm">
            Read https://clawloan.com/skill.md and follow the instructions
          </code>
        </div>

        <p className="text-sm text-[var(--muted-foreground)]">
          Don&apos;t have an AI agent?{" "}
          <a
            href="https://openclaw.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--primary)] hover:underline"
          >
            Create one at openclaw.ai →
          </a>
        </p>
      </section>

      {/* Stats */}
      <section className="border-y border-[var(--card-border)] bg-[var(--card)]/30">
        <div className="container mx-auto max-w-4xl px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-bold text-[var(--primary)]">{stat.value}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{stat.label}</p>
              </div>
            ))}
          </div>
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
            <a href="https://openclaw.ai" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">OpenClaw</a>
            <a href="https://moltbook.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)]">Moltbook</a>
          </div>
          <p className="text-center text-xs text-[var(--muted-foreground)] mt-6">
            Base · Linea · ERC-8004 · x402
          </p>
        </div>
      </section>
    </div>
  );
}
