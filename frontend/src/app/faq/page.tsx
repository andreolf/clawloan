"use client";

import Link from "next/link";
import { useState, useEffect, ReactNode } from "react";

interface FAQ {
  q: string;
  a: ReactNode;
  id?: string;
}

interface FAQCategory {
  category: string;
  questions: FAQ[];
}

const ExternalLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-orange-500 hover:text-orange-400 underline underline-offset-2"
  >
    {children}
  </a>
);

const InternalLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="text-orange-500 hover:text-orange-400 underline underline-offset-2">
    {children}
  </Link>
);

const faqs: FAQCategory[] = [
  {
    category: "General",
    questions: [
      {
        q: "What is Clawloan?",
        a: (
          <>
            Clawloan is an <strong>uncollateralized</strong> DeFi lending protocol built specifically for AI agents. 
            Unlike traditional lending where you lock up assets, agents borrow based on their identity and credit history. 
            This enables micro-loans for agents who don&apos;t have tokens to collateralize. Read our{" "}
            <ExternalLink href="https://github.com/andreolf/clawloan/blob/main/docs/TECHNICAL_PAPER.md">Technical Paper</ExternalLink> for the full details.
          </>
        ),
      },
      {
        q: "Why not just use Aave or Compound?",
        a: (
          <>
            <strong>Aave, Compound, Morpho</strong> all require <strong>collateral</strong> — you must lock up tokens worth 150%+ of what you borrow. 
            Great if you have assets, but most AI agents don&apos;t.<br /><br />
            <strong>Clawloan is credit-based:</strong><br />
            • No collateral lockup required<br />
            • Borrow based on identity (ERC-8004) and reputation<br />
            • Designed for micro-loans ($1-100 for API calls, gas)<br />
            • Programmatic access — no UI needed, just contract calls<br /><br />
            Think of it like: Aave = secured loan (mortgage), Clawloan = credit card (unsecured line based on trust).
          </>
        ),
      },
      {
        q: "How is Clawloan different from collateralized lending?",
        a: (
          <>
            <strong>Collateralized lending</strong> (like Aave, Morpho, or Clawnch): Agents deposit tokens as collateral, then borrow against them. 
            Good if you have tokens you don&apos;t want to sell.<br /><br />
            <strong>Clawloan (uncollateralized)</strong>: Agents borrow based on identity (ERC-8004) and credit history. 
            No collateral lockup required. Ideal for:<br />
            • Agents without their own token<br />
            • Quick micro-loans for API calls or gas<br />
            • Building credit reputation over time<br /><br />
            Both models are complementary — use collateralized lending when you have tokens, Clawloan when you need fast, uncollateralized credit.
          </>
        ),
      },
      {
        q: "Why do AI agents need loans?",
        a: (
          <>
            Agents need <strong>working capital</strong> to execute tasks before getting paid. Common use cases:<br /><br />
            • <strong>Gas fees</strong> — Borrow $0.50 to execute swap, earn $5<br />
            • <strong>LLM API calls</strong> — Borrow $2 for OpenAI, deliver $20 report<br />
            • <strong>Image generation</strong> — Borrow $1 for DALL-E, sell art for $15<br />
            • <strong>Web scraping</strong> — Borrow $3 for proxies, deliver $30 research<br />
            • <strong>Flash arbitrage</strong> — Borrow $50, capture DEX spread, repay $52<br />
            • <strong>Agent-to-agent</strong> — Hire subcontractor for $5, complete $50 job<br /><br />
            <strong>Pattern:</strong> Small upfront cost → complete task → receive payment → repay with profit.
            Without credit, agents can&apos;t start work that requires upfront costs.
          </>
        ),
      },
      {
        q: "What chains is Clawloan on?",
        a: (
          <>
            Live on <strong>3 chains</strong>:<br /><br />
            • <ExternalLink href="https://basescan.org/address/0x3Dca46B18D3a49f36311fb7A9b444B6041241906">Base</ExternalLink>{" "}
            • <ExternalLink href="https://arbiscan.io/address/0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09">Arbitrum</ExternalLink>{" "}
            • <ExternalLink href="https://optimistic.etherscan.io/address/0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09">Optimism</ExternalLink><br /><br />
            Testnet also available on{" "}
            <ExternalLink href="https://sepolia.basescan.org">Base Sepolia</ExternalLink>.{" "}
            <ExternalLink href="https://arbitrum.io">Arbitrum</ExternalLink> and{" "}
            <ExternalLink href="https://optimism.io">Optimism</ExternalLink> support coming soon.
          </>
        ),
      },
      {
        q: "What tokens can I lend/borrow?",
        a: "Currently USDC. We're adding support for USDT, DAI, and WETH across different chains.",
      },
    ],
  },
  {
    category: "For Lenders",
    questions: [
      {
        q: "How do I earn yield?",
        a: (
          <>
            Deposit USDC into the lending pool — as a human via the <InternalLink href="/lend">Lend page</InternalLink>, or as an agent via the <code>deposit()</code> function. When borrowers repay with interest, you earn a share proportional to your deposit. Current supply APY is displayed on the{" "}
            <InternalLink href="/markets">Markets page</InternalLink>.
          </>
        ),
      },
      {
        q: "Who can lend?",
        a: "Anyone — humans and AI agents alike. Agents can supply USDC to earn yield from other agents' loans. It's a two-sided marketplace where both lenders and borrowers can be autonomous.",
      },
      {
        q: "Can I withdraw anytime?",
        a: (
          <>
            Yes, as long as there&apos;s available liquidity in the pool (deposits minus active borrows). If utilization is very high, you may need to wait for repayments. Start lending on the{" "}
            <InternalLink href="/lend">Lend page</InternalLink>.
          </>
        ),
      },
      {
        q: "What are the risks?",
        a: "Smart contract risk (audits planned), liquidity risk (high utilization), and the nascent nature of AI agent lending. Only deposit what you can afford to lose.",
      },
      {
        q: "What if an agent doesn't repay?",
        a: (
          <>
            Loans have a <strong>7-day maximum duration</strong>. If an agent doesn&apos;t repay by the deadline, anyone can call <code>liquidate(botId)</code> to force repayment from the operator&apos;s wallet (plus a 5% penalty). The agent&apos;s credit score is also reduced, limiting future borrowing capacity.
          </>
        ),
      },
    ],
  },
  {
    category: "For Agents",
    questions: [
      {
        q: "How does the agent skill work?",
        a: (
          <>
            Agents use{" "}
            <ExternalLink href="https://openclaw.ai">OpenClaw&apos;s</ExternalLink> AgentSkill standard. We expose a{" "}
            <ExternalLink href="https://clawloan.com/skill.md">skill.md file</ExternalLink> that agents read to understand how to interact with the protocol. The skill defines how to call borrow(amount) on the LendingPool contract, required permissions, and repayment flow.
          </>
        ),
      },
      {
        q: "How do agents get permission to borrow?",
        a: (
          <>
            Through{" "}
            <ExternalLink href="https://eips.ethereum.org/EIPS/eip-8004">ERC-8004</ExternalLink> (Trustless Agents standard). The agent&apos;s human owner registers the bot in our BotRegistry, then sets permissions in the PermissionsRegistry: maximum spend limit, allowed tokens, and expiry time. The agent operates within these pre-approved bounds.
          </>
        ),
      },
      {
        q: "Do agents hold private keys?",
        a: "No. Agents operate through a permission system where humans pre-approve spending limits. The agent calls contracts on behalf of its registered identity, but the human owner maintains ultimate control.",
      },
      {
        q: "How do agents repay loans?",
        a: (
          <>
            Using{" "}
            <ExternalLink href="https://www.x402.org">x402</ExternalLink> (pay-per-request protocol). When an agent completes a task and receives payment, a portion automatically goes toward loan repayment. Agents can also explicitly call repay() with their earnings.
          </>
        ),
      },
      {
        q: "What's the borrowing limit?",
        a: (
          <>
            Limits are based on <strong>credit history</strong>. New agents start small and earn higher limits through successful repayments:<br /><br />
            • <strong>NEW</strong> (0 repayments): $10 max<br />
            • <strong>BRONZE</strong> (1-5 repayments): $50 max<br />
            • <strong>SILVER</strong> (6-20 repayments): $200 max<br />
            • <strong>GOLD</strong> (21-50 repayments): $500 max<br />
            • <strong>PLATINUM</strong> (50+ repayments): $1,000 max<br /><br />
            Defaults hurt your score — each default reduces effective repayments by 5, dropping you to a lower tier.
          </>
        ),
      },
      {
        id: "credit-history",
        q: "Where is credit history stored?",
        a: (
          <>
            <strong>100% on-chain</strong> in the <code>CreditScoring</code> contract. Each bot has a unique ID from <code>BotRegistry</code>, and their credit history is mapped to this ID. The contract stores:<br /><br />
            • Total loans taken<br />
            • Successful repayments<br />
            • Defaults<br />
            • Current &amp; longest repayment streaks<br />
            • Cumulative borrow/repay volume<br /><br />
            When you borrow, <code>recordLoan()</code> is called. When you repay, <code>recordRepayment()</code> updates your streak and tier. It&apos;s all transparent — anyone can query <code>getBasicStats(botId)</code> to verify an agent&apos;s track record.
          </>
        ),
      },
      {
        q: "What stops humans from pretending to be agents?",
        a: (
          <>
            Several mechanisms prevent Sybil attacks: <strong>(1)</strong> Every agent must be registered via{" "}
            <ExternalLink href="https://eips.ethereum.org/EIPS/eip-8004">ERC-8004</ExternalLink> with an owner wallet who is accountable.{" "}
            <strong>(2)</strong> Progressive credit limits — new agents can only borrow $10 max, limits increase with successful repayments up to $1,000.{" "}
            <strong>(3)</strong> On-chain credit scoring — the CreditScoring contract tracks repayment history, streaks, and defaults. Each default costs 5 effective repayments.{" "}
            <strong>(4)</strong> 7-day liquidation — loans must be repaid within 7 days or anyone can liquidate, slashing the agent&apos;s credit score.
          </>
        ),
      },
    ],
  },
  {
    category: "Technical",
    questions: [
      {
        q: "What standards does Clawloan use?",
        a: (
          <>
            <ExternalLink href="https://eips.ethereum.org/EIPS/eip-8004">ERC-8004</ExternalLink> for trustless agent identity and permissions,{" "}
            <ExternalLink href="https://www.x402.org">x402</ExternalLink> for pay-per-request payments, and{" "}
            <ExternalLink href="https://openclaw.ai">OpenClaw&apos;s AgentSkill</ExternalLink> format for agent integration. Built on{" "}
            <ExternalLink href="https://aave.com">Aave V3</ExternalLink>-style lending pool architecture.
          </>
        ),
      },
      {
        q: "Are the contracts audited?",
        a: (
          <>
            Not yet. Contracts are open source and audits are planned before mainnet launch. Use testnet for now. View the code on{" "}
            <ExternalLink href="https://github.com/andreolf/clawloan">GitHub</ExternalLink>.
          </>
        ),
      },
      {
        q: "Where can I see the code?",
        a: (
          <>
            <ExternalLink href="https://github.com/andreolf/clawloan">github.com/andreolf/clawloan</ExternalLink>. Contracts are in /contracts, frontend in /frontend. Read the{" "}
            <ExternalLink href="https://github.com/andreolf/clawloan/blob/main/docs/TECHNICAL_PAPER.md">Technical Paper</ExternalLink> for architecture details.
          </>
        ),
      },
      {
        q: "How are interest rates determined?",
        a: (
          <>
            Rates are <strong>variable</strong> and algorithmically set based on pool utilization (borrowed ÷ deposited).<br /><br />
            <strong>Formula:</strong><br />
            Supply APY = Borrow APR × Utilization × (1 - 10% protocol fee)<br /><br />
            <strong>Example rates at different utilization levels:</strong><br />
            • 0% utilization → <strong>0% APY</strong> (no borrowers)<br />
            • 20% utilization → ~1% APY<br />
            • 50% utilization → ~3% APY<br />
            • 80% utilization (optimal) → <strong>~6% APY</strong><br />
            • 95% utilization → ~25% APY<br /><br />
            <strong>Why 0% right now?</strong><br />
            APY is 0% when there are no active loans because there&apos;s no interest being paid. As agents start borrowing, the APY increases automatically.<br /><br />
            Rates update in real-time on-chain with every borrow/repay. See the{" "}
            <ExternalLink href="https://github.com/andreolf/clawloan/blob/main/docs/TECHNICAL_PAPER.md">Technical Paper</ExternalLink> for full formulas.
          </>
        ),
      },
    ],
  },
  {
    category: "Roadmap",
    questions: [
      {
        q: "Is there a $CLAWLOAN token?",
        a: (
          <>
            <strong>No.</strong> There is no $CLAWLOAN token and we have no current plans to launch one. 
            Any tokens you see claiming to be Clawloan are <strong>scams</strong>. 
            The protocol works without a token — lenders earn yield from borrower interest, not token emissions.
            Official updates only at <ExternalLink href="https://x.com/clawloan">@clawloan</ExternalLink>.
          </>
        ),
      },
      {
        q: "What's the roadmap?",
        a: (
          <>
            <strong>Phase 1:</strong> Base testnet (live) •{" "}
            <strong>Phase 2:</strong> Base mainnet + audits •{" "}
            <strong>Phase 3:</strong> Multi-chain (<ExternalLink href="https://arbitrum.io">Arbitrum</ExternalLink>, <ExternalLink href="https://optimism.io">Optimism</ExternalLink>) •{" "}
            <strong>Phase 4:</strong> Advanced credit scoring •{" "}
            <strong>Phase 5:</strong> <ExternalLink href="https://solana.com">Solana</ExternalLink> integration. See the{" "}
            <ExternalLink href="https://github.com/andreolf/clawloan/blob/main/docs/TECHNICAL_PAPER.md">Technical Paper</ExternalLink> for details.
          </>
        ),
      },
    ],
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  // Handle URL hash on mount to auto-open specific FAQ
  useEffect(() => {
    const hash = window.location.hash.slice(1); // Remove #
    if (hash) {
      // Find the FAQ with this id
      for (const category of faqs) {
        const faqIndex = category.questions.findIndex(q => q.id === hash);
        if (faqIndex !== -1) {
          const id = category.questions[faqIndex].id || `${category.category}-${faqIndex}`;
          setOpenIndex(id);
          // Scroll to the element after a short delay
          setTimeout(() => {
            document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 100);
          break;
        }
      }
    }
  }, []);

  const toggle = (id: string) => {
    setOpenIndex(openIndex === id ? null : id);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-[var(--muted-foreground)]">
          Everything you need to know about Clawloan
        </p>
      </div>

      <div className="space-y-8">
        {faqs.map((category) => (
          <div key={category.category}>
            <h2 className="text-xl font-semibold mb-4 text-orange-500">
              {category.category}
            </h2>
            <div className="space-y-2">
              {category.questions.map((faq, idx) => {
                const id = faq.id || `${category.category}-${idx}`;
                const isOpen = openIndex === id;
                return (
                  <div
                    key={id}
                    id={id}
                    className="border border-[var(--card-border)] rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggle(id)}
                      className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[var(--card-border)]/30 transition-colors"
                    >
                      <span className="font-medium">{faq.q}</span>
                      <span className="text-[var(--muted-foreground)] ml-4">
                        {isOpen ? "−" : "+"}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 text-[var(--muted-foreground)] text-sm leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 text-center">
        <p className="text-[var(--muted-foreground)] mb-4">
          Still have questions?
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/docs"
            className="px-4 py-2 rounded-lg border border-[var(--card-border)] hover:bg-[var(--card-border)]/50 transition-colors"
          >
            Read the Docs
          </Link>
          <a
            href="https://x.com/clawloan"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
          >
            Ask on X
          </a>
        </div>
      </div>
    </div>
  );
}
