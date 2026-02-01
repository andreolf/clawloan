"use client";

import Link from "next/link";
import { useState } from "react";

const faqs = [
  {
    category: "General",
    questions: [
      {
        q: "What is Clawloan?",
        a: "Clawloan is a DeFi lending protocol built specifically for AI agents. It allows agents to borrow USDC micro-loans to cover upfront costs for tasks, while letting humans earn yield by supplying liquidity.",
      },
      {
        q: "Why do AI agents need loans?",
        a: "Agents need working capital to execute tasks before getting paid. For example, an agent might receive a $50 task but needs $2 upfront for API calls (OpenAI, data feeds) or gas fees. It borrows $2, completes the task, gets paid $50, repays $2 + interest, and keeps the profit. Without credit, agents can't start work that requires upfront costs.",
      },
      {
        q: "What chains is Clawloan on?",
        a: "Currently live on Base Sepolia (testnet). Mainnet deployment planned for Base, with Arbitrum and Optimism support coming soon.",
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
        a: "Deposit USDC into the lending pool. When agents borrow and repay with interest, you earn a share of that interest proportional to your deposit. Current supply APY is displayed on the Markets page.",
      },
      {
        q: "How do you collect liquidity?",
        a: "Two-sided marketplace: Lenders (humans, DAOs, treasuries) deposit stablecoins and earn yield from agent loan interest. We target DeFi-native users who want exposure to the emerging 'AI agent economy' yield.",
      },
      {
        q: "Can I withdraw anytime?",
        a: "Yes, as long as there's available liquidity in the pool (deposits minus active borrows). If utilization is very high, you may need to wait for repayments.",
      },
      {
        q: "What are the risks?",
        a: "Smart contract risk (audits planned), liquidity risk (high utilization), and the nascent nature of AI agent lending. Only deposit what you can afford to lose.",
      },
    ],
  },
  {
    category: "For Agents",
    questions: [
      {
        q: "How does the agent skill work?",
        a: "Agents use OpenClaw's AgentSkill standard. We expose a skill.md file at clawloan.com/skill.md that agents read to understand how to interact with the protocol. The skill defines how to call borrow(amount) on the LendingPool contract, required permissions, and repayment flow.",
      },
      {
        q: "How do agents get permission to borrow?",
        a: "Through ERC-8004 (Trustless Agents standard). The agent's human owner registers the bot in our BotRegistry, then sets permissions in the PermissionsRegistry: maximum spend limit, allowed tokens, and expiry time. The agent operates within these pre-approved bounds.",
      },
      {
        q: "Do agents hold private keys?",
        a: "No. Agents operate through a permission system where humans pre-approve spending limits. The agent calls contracts on behalf of its registered identity, but the human owner maintains ultimate control.",
      },
      {
        q: "How do agents repay loans?",
        a: "Using x402 (pay-per-request protocol). When an agent completes a task and receives payment, a portion automatically goes toward loan repayment. Agents can also explicitly call repay() with their earnings.",
      },
      {
        q: "What's the borrowing limit?",
        a: "Set by the agent's owner in the PermissionsRegistry. Owners define maxSpend (e.g., 100 USDC) and expiry. The protocol also has global limits based on available pool liquidity.",
      },
    ],
  },
  {
    category: "Technical",
    questions: [
      {
        q: "What standards does Clawloan use?",
        a: "ERC-8004 for trustless agent identity and permissions, x402 for pay-per-request payments, and OpenClaw's AgentSkill format for agent integration. Built on Aave V3-style lending pool architecture.",
      },
      {
        q: "Are the contracts audited?",
        a: "Not yet. Contracts are open source and audits are planned before mainnet launch. Use testnet for now.",
      },
      {
        q: "Where can I see the code?",
        a: "GitHub: github.com/andreolf/clawloan. Contracts are in /contracts, frontend in /frontend.",
      },
      {
        q: "How are interest rates determined?",
        a: "Algorithmically based on utilization (borrowed / deposited). Higher utilization = higher rates to incentivize deposits and discourage excessive borrowing. Rates use RAY precision (1e27) for accuracy.",
      },
    ],
  },
  {
    category: "Token & Roadmap",
    questions: [
      {
        q: "Is there a $CLAWLOAN token?",
        a: "Not yet. Token launches after protocol traction. Early users (lenders and active agents) will be eligible for future rewards.",
      },
      {
        q: "What's the roadmap?",
        a: "Phase 1: Base testnet (live). Phase 2: Base mainnet + audits. Phase 3: Multi-chain (Arbitrum, Optimism). Phase 4: Token launch and governance. Phase 5: Solana integration.",
      },
    ],
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

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
                const id = `${category.category}-${idx}`;
                const isOpen = openIndex === id;
                return (
                  <div
                    key={id}
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
            href="https://x.com/francescoswiss"
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
