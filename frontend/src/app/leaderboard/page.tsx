"use client";

import React, { useEffect, useState } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { base, arbitrum, optimism } from "viem/chains";
import Link from "next/link";

const CHAINS = [
  {
    id: 8453, chain: base, name: "Base", icon: "🔵", rpc: "https://mainnet.base.org",
    botRegistry: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A",
    creditScoring: "0x0E7d8675c4e0a0783B1B51eDe3aaB8D8BDc6B9Ad",
    explorer: "https://basescan.org"
  },
  {
    id: 42161, chain: arbitrum, name: "Arbitrum", icon: "🔷", rpc: "https://arb1.arbitrum.io/rpc",
    botRegistry: "0xe19320FB36d07CCBC14b239453F36Ed958DeDEF0",
    creditScoring: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A",
    explorer: "https://arbiscan.io"
  },
  {
    id: 10, chain: optimism, name: "Optimism", icon: "🔴", rpc: "https://mainnet.optimism.io",
    botRegistry: "0xe19320FB36d07CCBC14b239453F36Ed958DeDEF0",
    creditScoring: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A",
    explorer: "https://optimistic.etherscan.io"
  },
];

const BOT_REGISTRY_ABI = [
  { name: "nextBotId", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    name: "getBot", type: "function", stateMutability: "view",
    inputs: [{ name: "botId", type: "uint256" }],
    outputs: [
      { name: "metadataHash", type: "string" },
      { name: "operator", type: "address" },
      { name: "registeredAt", type: "uint256" },
      { name: "active", type: "bool" }
    ]
  },
] as const;

const CREDIT_SCORING_ABI = [
  {
    name: "getBasicStats", type: "function", stateMutability: "view",
    inputs: [{ name: "botId", type: "uint256" }],
    outputs: [
      { name: "totalLoans", type: "uint256" },
      { name: "successfulRepayments", type: "uint256" },
      { name: "defaults", type: "uint256" },
      { name: "currentStreak", type: "uint256" },
      { name: "creditTier", type: "uint256" }
    ]
  },
  {
    name: "getCreditScore", type: "function", stateMutability: "view",
    inputs: [{ name: "botId", type: "uint256" }],
    outputs: [{ name: "score", type: "uint256" }]
  },
  {
    name: "getVolumeStats", type: "function", stateMutability: "view",
    inputs: [{ name: "botId", type: "uint256" }],
    outputs: [
      { name: "totalBorrowed", type: "uint256" },
      { name: "totalRepaid", type: "uint256" },
      { name: "longestStreak", type: "uint256" },
      { name: "recommendedLimit", type: "uint256" }
    ]
  },
] as const;

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
  const [sortBy, setSortBy] = useState<"score" | "rate" | "repayments" | "volume">("score");

  useEffect(() => {
    async function fetchAllAgents() {
      const allAgents: AgentStats[] = [];

      await Promise.all(
        CHAINS.map(async (chainConfig) => {
          const client = createPublicClient({
            chain: chainConfig.chain,
            transport: http(chainConfig.rpc),
          });

          try {
            // Get total bot count
            const nextBotId = await client.readContract({
              address: chainConfig.botRegistry as `0x${string}`,
              abi: BOT_REGISTRY_ABI,
              functionName: "nextBotId",
            });

            // Fetch all bots in parallel
            const botIds = Array.from({ length: Number(nextBotId) - 1 }, (_, i) => i + 1);
            const botResults = await Promise.all(
              botIds.map(async (botId) => {
                try {
                  const [botInfo, basicStats, creditScore, volumeStats] = await Promise.all([
                    client.readContract({
                      address: chainConfig.botRegistry as `0x${string}`,
                      abi: BOT_REGISTRY_ABI,
                      functionName: "getBot",
                      args: [BigInt(botId)],
                    }),
                    client.readContract({
                      address: chainConfig.creditScoring as `0x${string}`,
                      abi: CREDIT_SCORING_ABI,
                      functionName: "getBasicStats",
                      args: [BigInt(botId)],
                    }),
                    client.readContract({
                      address: chainConfig.creditScoring as `0x${string}`,
                      abi: CREDIT_SCORING_ABI,
                      functionName: "getCreditScore",
                      args: [BigInt(botId)],
                    }),
                    client.readContract({
                      address: chainConfig.creditScoring as `0x${string}`,
                      abi: CREDIT_SCORING_ABI,
                      functionName: "getVolumeStats",
                      args: [BigInt(botId)],
                    }),
                  ]);

                  return {
                    botId,
                    operator: botInfo[1],
                    chainId: chainConfig.id,
                    chainName: chainConfig.name,
                    chainIcon: chainConfig.icon,
                    explorer: chainConfig.explorer,
                    active: botInfo[3],
                    totalLoans: Number(basicStats[0]),
                    successfulRepayments: Number(basicStats[1]),
                    defaults: Number(basicStats[2]),
                    currentStreak: Number(basicStats[3]),
                    creditTier: Number(basicStats[4]),
                    creditScore: Number(creditScore),
                    totalBorrowed: Number(formatUnits(volumeStats[0], 6)),
                    totalRepaid: Number(formatUnits(volumeStats[1], 6)),
                  };
                } catch (err) {
                  // Bot might not exist or have no credit history
                  console.error(`Error fetching bot ${botId} on ${chainConfig.name}:`, err);
                  return null;
                }
              })
            );

            // Filter out nulls and add to allAgents
            botResults.forEach(result => {
              if (result) allAgents.push(result);
            });
          } catch (err) {
            console.error(`Error fetching from ${chainConfig.name}:`, err);
          }
        })
      );

      // Sort by default (credit score)
      allAgents.sort((a, b) => b.creditScore - a.creditScore);
      setAgents(allAgents);
      setLoading(false);
    }

    fetchAllAgents();
  }, []);

  const getSuccessRate = (agent: AgentStats) =>
    agent.totalLoans > 0 ? agent.successfulRepayments / agent.totalLoans : 0;

  const sortedAgents = [...agents].sort((a, b) => {
    switch (sortBy) {
      case "score": return b.creditScore - a.creditScore;
      case "rate": return getSuccessRate(b) - getSuccessRate(a);
      case "repayments": return b.successfulRepayments - a.successfulRepayments;
      case "volume": return b.totalRepaid - a.totalRepaid;
      default: return 0;
    }
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
            onClick={() => {
              console.log("Sorting by:", opt.key);
              setSortBy(opt.key as typeof sortBy);
            }}
            className={`px-3 py-1 text-sm rounded-full transition-colors cursor-pointer ${sortBy === opt.key
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
                    <th className="px-2 sm:px-4 py-3 text-right">Score</th>
                    <th className="px-2 sm:px-4 py-3 text-right hidden sm:table-cell">Rate</th>
                    <th className="px-2 sm:px-4 py-3 text-right">Loans</th>
                    <th className="px-2 sm:px-4 py-3 text-right hidden sm:table-cell">Volume</th>
                    <th className="px-2 sm:px-4 py-3 text-right">Streak</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAgents.map((agent, index) => (
                    <tr
                      key={`${agent.chainId}-${agent.botId}`}
                      className="border-t border-[var(--card-border)] hover:bg-[var(--muted)]/10 transition-colors text-xs sm:text-sm"
                    >
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-[var(--muted-foreground)]">
                        {index + 1}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs sm:text-sm">Bot #{agent.botId}</span>
                          <a
                            href={`${agent.explorer}/address/${agent.operator}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] sm:text-xs text-[var(--muted-foreground)] hover:text-[var(--primary)]"
                          >
                            {shortenAddress(agent.operator)}
                          </a>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <span title={agent.chainName}>{agent.chainIcon}</span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <span className={`font-medium text-xs sm:text-sm ${TIER_COLORS[agent.creditTier]}`}>
                          {TIER_NAMES[agent.creditTier]}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono">
                        {agent.creditScore}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right hidden sm:table-cell">
                        {agent.totalLoans > 0 ? (
                          <span className={
                            agent.totalLoans === agent.successfulRepayments
                              ? "text-green-400 font-medium"
                              : agent.defaults > 0
                                ? "text-red-400"
                                : "text-yellow-400"
                          }>
                            {((agent.successfulRepayments / agent.totalLoans) * 100).toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-[var(--muted-foreground)]">—</span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                        <span className="text-green-400">{agent.successfulRepayments}</span>
                        <span className="text-[var(--muted-foreground)]">/</span>
                        <span className="text-[var(--muted-foreground)]">{agent.totalLoans}</span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-mono hidden sm:table-cell">
                        ${agent.totalRepaid.toLocaleString()}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                        {agent.currentStreak > 0 ? (
                          <span className="text-green-400">🔥{agent.currentStreak}</span>
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

      <div className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
        <p>Data pulled directly from on-chain CreditScoring contracts</p>
        <Link href="/faq#credit-history" className="text-[var(--primary)] hover:underline">
          Learn how credit scoring works →
        </Link>
      </div>
    </div>
  );
}
