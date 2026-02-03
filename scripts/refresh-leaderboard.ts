#!/usr/bin/env npx ts-node
/**
 * Leaderboard Refresh Script
 * Fetches on-chain data from all chains and updates the static leaderboard.json
 * 
 * Usage: npx ts-node scripts/refresh-leaderboard.ts
 * Or:    npm run refresh-leaderboard
 */

import { createPublicClient, http, formatUnits } from "viem";
import { base, arbitrum, optimism } from "viem/chains";
import * as fs from "fs";
import * as path from "path";

const CHAINS = [
  {
    id: 8453, chain: base, name: "Base", icon: "🔵",
    rpc: process.env.BASE_RPC || "https://base-mainnet.g.alchemy.com/v2/demo",
    botRegistry: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A" as `0x${string}`,
    creditScoring: "0x0E7d8675c4e0a0783B1B51eDe3aaB8D8BDc6B9Ad" as `0x${string}`,
    explorer: "https://basescan.org"
  },
  {
    id: 42161, chain: arbitrum, name: "Arbitrum", icon: "🔷",
    rpc: process.env.ARB_RPC || "https://arb-mainnet.g.alchemy.com/v2/demo",
    botRegistry: "0xe19320FB36d07CCBC14b239453F36Ed958DeDEF0" as `0x${string}`,
    creditScoring: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A" as `0x${string}`,
    explorer: "https://arbiscan.io"
  },
  {
    id: 10, chain: optimism, name: "Optimism", icon: "🔴",
    rpc: process.env.OP_RPC || "https://opt-mainnet.g.alchemy.com/v2/demo",
    botRegistry: "0xe19320FB36d07CCBC14b239453F36Ed958DeDEF0" as `0x${string}`,
    creditScoring: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A" as `0x${string}`,
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

interface Agent {
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
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchChainAgents(chainConfig: typeof CHAINS[0]): Promise<Agent[]> {
  const agents: Agent[] = [];
  
  console.log(`Fetching from ${chainConfig.name}...`);
  
  const client = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpc),
  });

  try {
    // Get total bot count
    const nextBotId = await client.readContract({
      address: chainConfig.botRegistry,
      abi: BOT_REGISTRY_ABI,
      functionName: "nextBotId",
    }) as bigint;

    const botCount = Number(nextBotId);
    console.log(`  Found ${botCount} bots on ${chainConfig.name}`);

    // Fetch each bot with delays to avoid rate limits
    for (let i = 1; i < botCount; i++) {
      try {
        await sleep(200); // 200ms between calls
        
        const [botData, basicStats, creditScore, volumeStats] = await Promise.all([
          client.readContract({
            address: chainConfig.botRegistry,
            abi: BOT_REGISTRY_ABI,
            functionName: "getBot",
            args: [BigInt(i)],
          }),
          client.readContract({
            address: chainConfig.creditScoring,
            abi: CREDIT_SCORING_ABI,
            functionName: "getBasicStats",
            args: [BigInt(i)],
          }),
          client.readContract({
            address: chainConfig.creditScoring,
            abi: CREDIT_SCORING_ABI,
            functionName: "getCreditScore",
            args: [BigInt(i)],
          }),
          client.readContract({
            address: chainConfig.creditScoring,
            abi: CREDIT_SCORING_ABI,
            functionName: "getVolumeStats",
            args: [BigInt(i)],
          }),
        ]);

        const [, operator, , active] = botData as [string, string, bigint, boolean];
        const [totalLoans, successfulRepayments, defaults, currentStreak, creditTier] = basicStats as [bigint, bigint, bigint, bigint, bigint];
        const [totalBorrowed, totalRepaid] = volumeStats as [bigint, bigint, bigint, bigint];

        agents.push({
          botId: i,
          operator,
          chainId: chainConfig.id,
          chainName: chainConfig.name,
          chainIcon: chainConfig.icon,
          explorer: chainConfig.explorer,
          active,
          totalLoans: Number(totalLoans),
          successfulRepayments: Number(successfulRepayments),
          defaults: Number(defaults),
          currentStreak: Number(currentStreak),
          creditTier: Number(creditTier),
          creditScore: Number(creditScore),
          totalBorrowed: Number(formatUnits(totalBorrowed, 6)),
          totalRepaid: Number(formatUnits(totalRepaid, 6)),
        });

        console.log(`  Bot #${i}: score=${creditScore}, loans=${totalLoans}`);
      } catch (err) {
        console.error(`  Error fetching bot #${i}:`, err);
      }
    }
  } catch (err) {
    console.error(`Error on ${chainConfig.name}:`, err);
  }

  return agents;
}

async function main() {
  console.log("🔄 Refreshing leaderboard data...\n");

  const allAgents: Agent[] = [];

  // Fetch from each chain sequentially to avoid rate limits
  for (const chain of CHAINS) {
    const agents = await fetchChainAgents(chain);
    allAgents.push(...agents);
    await sleep(1000); // 1s pause between chains
  }

  // Sort by credit score descending
  allAgents.sort((a, b) => b.creditScore - a.creditScore);

  const output = {
    agents: allAgents,
    lastUpdated: new Date().toISOString(),
  };

  // Write to frontend public folder
  const outputPath = path.join(__dirname, "..", "frontend", "public", "data", "leaderboard.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Updated ${outputPath}`);
  console.log(`   Total agents: ${allAgents.length}`);
  console.log(`   Last updated: ${output.lastUpdated}`);
}

main().catch(console.error);
