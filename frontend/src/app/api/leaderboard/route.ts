import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { base, arbitrum, optimism } from "viem/chains";

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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function GET() {
  const allAgents: AgentStats[] = [];

  // Process chains sequentially
  for (const chainConfig of CHAINS) {
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

      // Fetch bots one at a time with longer delays
      for (let botId = 1; botId < Number(nextBotId); botId++) {
        try {
          // Longer delay between bots to avoid rate limiting
          if (botId > 1) await delay(300);
          
          // Fetch bot info first
          const botInfo = await client.readContract({
            address: chainConfig.botRegistry as `0x${string}`,
            abi: BOT_REGISTRY_ABI,
            functionName: "getBot",
            args: [BigInt(botId)],
          });

          await delay(100);

          // Then credit stats
          const basicStats = await client.readContract({
            address: chainConfig.creditScoring as `0x${string}`,
            abi: CREDIT_SCORING_ABI,
            functionName: "getBasicStats",
            args: [BigInt(botId)],
          });

          await delay(100);

          const creditScore = await client.readContract({
            address: chainConfig.creditScoring as `0x${string}`,
            abi: CREDIT_SCORING_ABI,
            functionName: "getCreditScore",
            args: [BigInt(botId)],
          });

          await delay(100);

          const volumeStats = await client.readContract({
            address: chainConfig.creditScoring as `0x${string}`,
            abi: CREDIT_SCORING_ABI,
            functionName: "getVolumeStats",
            args: [BigInt(botId)],
          });

          allAgents.push({
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
          });
        } catch (err) {
          console.error(`Error fetching bot ${botId} on ${chainConfig.name}:`, err);
          // Add with defaults
          allAgents.push({
            botId,
            operator: "0x0000000000000000000000000000000000000000",
            chainId: chainConfig.id,
            chainName: chainConfig.name,
            chainIcon: chainConfig.icon,
            explorer: chainConfig.explorer,
            active: true,
            totalLoans: 0,
            successfulRepayments: 0,
            defaults: 0,
            currentStreak: 0,
            creditTier: 0,
            creditScore: 500,
            totalBorrowed: 0,
            totalRepaid: 0,
          });
        }
      }
      
      // Longer delay between chains
      await delay(500);
    } catch (err) {
      console.error(`Error fetching from ${chainConfig.name}:`, err);
    }
  }

  // Sort by credit score
  allAgents.sort((a, b) => b.creditScore - a.creditScore);

  return NextResponse.json({ 
    agents: allAgents,
    timestamp: Date.now(),
  }, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
