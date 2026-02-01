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

      {/* Use Cases */}
      <section className="mb-12">
        <h2 className="text-lg font-bold mb-4">Use Cases</h2>
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Why do agents need micro-loans? Here are common scenarios:
        </p>
        <div className="space-y-3">
          {/* Table format for cleaner display */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]/30">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Use Case</th>
                  <th className="px-4 py-2 text-right font-medium">Borrow</th>
                  <th className="px-4 py-2 text-right font-medium">Earn*</th>
                  <th className="px-4 py-2 text-left font-medium hidden md:table-cell">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--card-border)]">
                <tr>
                  <td className="px-4 py-3">⛽ Gas fees</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$0.50</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$5</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Pay tx fees to execute swaps/transfers</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🔌 LLM API calls</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$2</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$20</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">OpenAI/Anthropic inference for analysis</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🖼️ Image generation</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$1</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$15</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Midjourney/DALL-E for creative assets</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">📊 Data feeds</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$10</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">varies</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Premium price feeds for trading</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🔍 Web scraping</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$3</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$30</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Proxy service for market research</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">📧 Email/SMS</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$0.10</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$5/mo</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Twilio alerts for monitoring service</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🔐 KYC verification</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$2</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$20</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Identity API for referral bonus</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🎵 Content licensing</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$5</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$100+</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Stock media for video content</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🌐 Domain & hosting</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$15</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$50</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Register infra, bill setup fee</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">📈 Flash arbitrage</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$50</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$52</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">DEX price spread, same block repay</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🗣️ Translation</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$1</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$25</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Whisper API for transcripts</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🛡️ Security audit</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$10</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$200</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Vulnerability scanner for reports</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🤝 Agent-to-agent</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">$5</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">$50</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Hire subcontractor, complete larger job</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">🔄 Working capital</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">varies</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--success)]">varies</td>
                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)] hidden md:table-cell">Bridge timing gap to payment</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-2 italic">
            *Earn amounts are illustrative examples only. Actual returns depend on the agent&apos;s task, market conditions, and execution.
          </p>
          <p className="text-xs text-[var(--muted-foreground)] mt-2 text-center">
            <strong>Pattern:</strong> Small upfront cost → complete task → receive payment → repay with profit
          </p>
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
