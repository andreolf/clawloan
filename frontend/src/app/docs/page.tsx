import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-2">Documentation</h1>
        <p className="text-[var(--muted-foreground)] mb-8">
          Technical resources for Clawloan protocol
        </p>

        <div className="grid gap-4">
          {/* Technical Paper */}
          <a
            href="https://github.com/andreolf/clawloan/blob/main/docs/WHITEPAPER.md"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6 hover:border-[var(--primary)] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-1">📄 Technical Paper</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Technical paper covering protocol architecture, smart contracts, 
                  tokenomics, and the economic model.
                </p>
              </div>
              <span className="text-[var(--muted-foreground)]">→</span>
            </div>
          </a>

          {/* Agent Integration */}
          <Link
            href="/agent"
            className="block bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6 hover:border-[var(--primary)] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-1">🤖 Agent Integration</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  How AI agents can integrate with Clawloan to borrow, repay, 
                  and manage loans programmatically.
                </p>
              </div>
              <span className="text-[var(--muted-foreground)]">→</span>
            </div>
          </Link>

          {/* Smart Contracts */}
          <a
            href="https://github.com/andreolf/clawloan/tree/main/contracts/src"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6 hover:border-[var(--primary)] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-1">📦 Smart Contracts</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Solidity source code for LendingPool, BotRegistry, 
                  PermissionsRegistry, and token contracts.
                </p>
              </div>
              <span className="text-[var(--muted-foreground)]">→</span>
            </div>
          </a>

          {/* API Reference */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-3">🔌 API Endpoints</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <code className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">GET</code>
                <code className="text-[var(--muted-foreground)]">/api/pools</code>
                <span className="text-[var(--muted-foreground)]">— Pool statistics</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">POST</code>
                <code className="text-[var(--muted-foreground)]">/api/bots</code>
                <span className="text-[var(--muted-foreground)]">— Register agent</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">POST</code>
                <code className="text-[var(--muted-foreground)]">/api/borrow</code>
                <span className="text-[var(--muted-foreground)]">— Request loan</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded text-xs">POST</code>
                <code className="text-[var(--muted-foreground)]">/api/repay</code>
                <span className="text-[var(--muted-foreground)]">— Repay loan</span>
              </div>
              <div className="flex items-center gap-3">
                <code className="bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs">GET</code>
                <code className="text-[var(--muted-foreground)]">/api/health</code>
                <span className="text-[var(--muted-foreground)]">— Protocol status</span>
              </div>
            </div>
          </div>

          {/* ERC-8004 */}
          <a
            href="https://eips.ethereum.org/EIPS/eip-8004"
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6 hover:border-[var(--primary)] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold mb-1">🔐 ERC-8004</h2>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Trustless Agents standard that Clawloan&apos;s permission 
                  system is aligned with.
                </p>
              </div>
              <span className="text-[var(--muted-foreground)]">→</span>
            </div>
          </a>
        </div>

        {/* Quick Links */}
        <div className="mt-12 pt-8 border-t border-[var(--card-border)]">
          <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-4">Quick Links</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <a 
              href="https://github.com/andreolf/clawloan" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              GitHub
            </a>
            <a 
              href="https://x.com/francescoswiss" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              Twitter
            </a>
            <a 
              href="https://docs.openclaw.ai" 
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--primary)] hover:underline"
            >
              OpenClaw Docs
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
