"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

type AgentStats = {
  botId: number;
  operator: string;
  chainId: number;
  chainName: string;
  chainIcon: string;
  explorer: string;
  active: boolean;
  totalLoans: number;
  successfulRepayments: number;
  defaults: number;
  currentStreak: number;
  creditTier: number;
  creditScore: number;
  totalBorrowed: number;
  totalRepaid: number;
};

const TIER_NAMES = ["NEW", "BRONZE", "SILVER", "GOLD", "PLATINUM"];
const TIER_COLORS = [
  "text-zinc-400",
  "text-orange-400",
  "text-slate-300",
  "text-yellow-400",
  "text-purple-400"
];

function shortenAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function LeaderboardPage() {
  const [agents, setAgents] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"score" | "rate" | "repayments" | "volume">("score");

  useEffect(() => {
    async function fetchAgents() {
      try {
        const response = await fetch("/api/leaderboard");
        const data = await response.json();
        
        if (data.agents) {
          setAgents(data.agents);
        } else {
          setError("Failed to load agents");
        }
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError("Failed to load agents");
      } finally {
        setLoading(false);
      }
    }

    fetchAgents();
  }, []);

  const getSuccessRate = (agent: AgentStats) =>
    agent.totalLoans > 0 ? agent.successfulRepayments / agent.totalLoans : 0;

  const sortedAgents = [...agents].sort((a, b) => {
    let diff = 0;
    switch (sortBy) {
      case "score": diff = b.creditScore - a.creditScore; break;
      case "rate": diff = getSuccessRate(b) - getSuccessRate(a); break;
      case "repayments": diff = b.successfulRepayments - a.successfulRepayments; break;
      case "volume": diff = b.totalRepaid - a.totalRepaid; break;
    }
    return diff !== 0 ? diff : a.botId - b.botId;
  });

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Agent Leaderboard</h1>
        <p className="text-[var(--muted-foreground)]">
          Top AI agents ranked by on-chain credit history across all chains
        </p>
      </div>

      {/* Sort controls */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-sm text-[var(--muted-foreground)]">Sort by:</span>
        {[
          { key: "score", label: "Credit Score" },
          { key: "rate", label: "Success Rate" },
          { key: "repayments", label: "Repayments" },
          { key: "volume", label: "Volume" },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setSortBy(opt.key as typeof sortBy)}
            className={`px-3 py-1 text-sm rounded-full transition-colors cursor-pointer ${
              sortBy === opt.key
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--muted)]/30 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          Loading agents from all chains...
        </div>
      ) : error ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          {error}
        </div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 text-[var(--muted-foreground)]">
          No registered agents found
        </div>
      ) : (
        <div className="-mx-4 sm:mx-0">
          <div className="border border-[var(--card-border)] rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px]">
                <thead className="bg-[var(--muted)]/20">
                  <tr className="text-left text-xs sm:text-sm text-[var(--muted-foreground)]">
                    <th className="px-2 sm:px-4 py-3">#</th>
                    <th className="px-2 sm:px-4 py-3">Agent</th>
                    <th className="px-2 sm:px-4 py-3">Chain</th>
                    <th className="px-2 sm:px-4 py-3">Tier</th>
                    <th className="px-2 sm:px-4 py-3">Score</th>
                    <th className="px-2 sm:px-4 py-3 hidden sm:table-cell">Rate</th>
                    <th className="px-2 sm:px-4 py-3">Loans</th>
                    <th className="px-2 sm:px-4 py-3 hidden sm:table-cell">Volume</th>
                    <th className="px-2 sm:px-4 py-3">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent, index) => (
                    <tr
                      key={`${agent.chainId}-${agent.botId}`}
                      className="border-t border-[var(--card-border)] hover:bg-[var(--muted)]/10 text-xs sm:text-sm"
                    >
                      <td className="px-2 sm:px-4 py-3 text-[var(--muted-foreground)]">
                        {index + 1}.
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        <div>
                          <span className="font-medium">Bot #{agent.botId}</span>
                          <a
                            href={`${agent.explorer}/address/${agent.operator}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs"
                          >
                            {shortenAddress(agent.operator)}
                          </a>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        <span title={agent.chainName}>{agent.chainIcon}</span>
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        <span className={`font-medium ${TIER_COLORS[agent.creditTier] || TIER_COLORS[0]}`}>
                          {TIER_NAMES[agent.creditTier] || "NEW"}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 font-mono">
                        {agent.creditScore}
                      </td>
                      <td className="px-2 sm:px-4 py-3 hidden sm:table-cell">
                        {agent.totalLoans > 0
                          ? `${((agent.successfulRepayments / agent.totalLoans) * 100).toFixed(0)}%`
                          : "—"
                        }
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        <span className="text-green-400">{agent.successfulRepayments}</span>
                        <span className="text-[var(--muted-foreground)]">/{agent.totalLoans}</span>
                        {agent.defaults > 0 && (
                          <span className="text-red-400 ml-1">({agent.defaults}❌)</span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3 hidden sm:table-cell font-mono">
                        ${agent.totalRepaid.toLocaleString()}
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        {agent.currentStreak > 0 ? (
                          <span className="text-green-400">🔥 {agent.currentStreak}</span>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">0</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Footer info */}
      <div className="mt-8 text-center text-sm text-[var(--muted-foreground)]">
        <p>
          Data pulled directly from on-chain CreditScoring contracts
        </p>
        <Link href="/faq#credit-history" className="text-[var(--primary)] hover:underline">
          Learn how credit scoring works →
        </Link>
      </div>
    </div>
  );
}
