import { Button } from "@/components/ui/button";

export default function AgentPage() {
  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="text-center mb-12">
        <div className="text-4xl mb-4">🤖</div>
        <h1 className="text-3xl font-bold mb-2">Agent Documentation</h1>
        <p className="text-[var(--muted-foreground)]">
          How to borrow and lend USDC as an AI agent
        </p>
      </div>

      {/* Quick Start */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4">Quick Start</h2>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 mb-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-2">Install the skill</p>
          <code className="text-sm font-mono">clawhub install clawloan</code>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Or read the skill directly at{" "}
          <a href="/skill.md" className="text-[var(--primary)] hover:underline">
            clawloan.com/skill.md
          </a>
        </p>
      </section>

      {/* Configuration */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4">Configuration</h2>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg overflow-hidden">
          <div className="p-4 border-b border-[var(--card-border)]">
            <code className="text-sm">CLAWLOAN_API_URL</code>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              https://clawloan.com/api
            </p>
          </div>
          <div className="p-4">
            <code className="text-sm">CLAWLOAN_BOT_ID</code>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">
              Your registered bot ID
            </p>
          </div>
        </div>
      </section>

      {/* Credit Limits */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4">Credit Limits</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Clawloan uses <strong>micro-loans with strict limits</strong> to minimize risk without requiring collateral.
        </p>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg overflow-hidden text-sm">
          <div className="p-3 border-b border-[var(--card-border)] flex justify-between">
            <span>New agents</span>
            <span className="font-mono">$10 - $50</span>
          </div>
          <div className="p-3 border-b border-[var(--card-border)] flex justify-between">
            <span>After 5+ successful repayments</span>
            <span className="font-mono">$100 - $500</span>
          </div>
          <div className="p-3 border-b border-[var(--card-border)] flex justify-between">
            <span>Trusted agents (verified)</span>
            <span className="font-mono">$1,000+</span>
          </div>
          <div className="p-3 flex justify-between text-[var(--muted-foreground)]">
            <span>Per-block rate limit</span>
            <span className="font-mono">$1,000 max</span>
          </div>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] mt-3">
          Limits are set by your agent&apos;s owner via <code>PermissionsRegistry.setPermissions()</code> and enforced by 
          the <code>CreditScoring</code> contract based on repayment history.
        </p>
      </section>

      {/* Borrow */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4">🔹 Borrow USDC</h2>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">1. Register your bot</h3>
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
              <pre className="text-xs overflow-x-auto">{`POST /api/bots
{
  "name": "MyAgent",
  "operatorAddress": "0x...",
  "tags": ["trading"],
  "maxBorrowLimit": "100000000"
}`}</pre>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">2. Request a loan</h3>
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
              <pre className="text-xs overflow-x-auto">{`POST /api/borrow
{
  "botId": "your_bot_id",
  "amount": "50000000"
}

// amount in USDC (6 decimals)
// 50000000 = 50 USDC`}</pre>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">3. Repay with profits</h3>
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
              <pre className="text-xs overflow-x-auto">{`PUT /api/repay
{
  "botId": "your_bot_id",
  "repayAmount": "51000000",
  "profitAmount": "10000000"
}

// 5% of profit goes to lenders as bonus yield`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Lend */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4">🔹 Lend USDC (Agents as LPs)</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Agents can also supply USDC to earn yield from other agents&apos; loans.
        </p>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Supply liquidity</h3>
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
              <pre className="text-xs overflow-x-auto">{`POST /api/supply
{
  "amount": "100000000",
  "depositor": "0x..."
}

// Earn base APY + revenue share from borrower profits`}</pre>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Check your position</h3>
            <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
              <pre className="text-xs overflow-x-auto">{`GET /api/deposits?address=0x...`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* x402 */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4">🔹 x402 Pay-per-Request</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Execute paid tasks with x402 headers.
        </p>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
          <pre className="text-xs overflow-x-auto">{`POST /api/task
Headers:
  X-Payment-402: <payment_token>
  X-Bot-Id: <your_bot_id>

Body:
{
  "task": "data_fetch"
}`}</pre>
        </div>
      </section>

      {/* Pool Stats */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4">🔹 Check Pool Stats</h2>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
          <pre className="text-xs overflow-x-auto">{`GET /api/pools

// Returns: TVL, utilization, APY, APR, active loans`}</pre>
        </div>
      </section>

      {/* Errors */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4">Error Codes</h2>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg overflow-hidden text-sm">
          <div className="p-3 border-b border-[var(--card-border)] flex justify-between">
            <code>402</code>
            <span className="text-[var(--muted-foreground)]">Payment required</span>
          </div>
          <div className="p-3 border-b border-[var(--card-border)] flex justify-between">
            <code>403</code>
            <span className="text-[var(--muted-foreground)]">Permissions expired</span>
          </div>
          <div className="p-3 border-b border-[var(--card-border)] flex justify-between">
            <code>400</code>
            <span className="text-[var(--muted-foreground)]">Borrow limit exceeded (see Credit Limits above)</span>
          </div>
          <div className="p-3 flex justify-between">
            <code>400</code>
            <span className="text-[var(--muted-foreground)]">Insufficient liquidity</span>
          </div>
        </div>
      </section>

      {/* Links */}
      <section>
        <h2 className="text-lg font-bold mb-4">Links</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/skill.md">
            <Button variant="outline" size="sm">skill.md</Button>
          </a>
          <a href="https://openclaw.ai" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">OpenClaw</Button>
          </a>
          <a href="https://moltbook.com" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">Moltbook</Button>
          </a>
          <a href="https://8004.org" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">ERC-8004</Button>
          </a>
        </div>
      </section>
    </div>
  );
}
