import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { base, arbitrum, optimism } from "viem/chains";

// Use Alchemy free tier RPCs which have better rate limits
const CHAINS = [
  {
    id: 8453, chain: base, name: "Base", icon: "🔵",
    rpc: "https://base-mainnet.g.alchemy.com/v2/demo",
    botRegistry: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A",
    creditScoring: "0x0E7d8675c4e0a0783B1B51eDe3aaB8D8BDc6B9Ad",
    explorer: "https://basescan.org"
  },
  {
    id: 42161, chain: arbitrum, name: "Arbitrum", icon: "🔷",
    rpc: "https://arb-mainnet.g.alchemy.com/v2/demo",
    botRegistry: "0xe19320FB36d07CCBC14b239453F36Ed958DeDEF0",
    creditScoring: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A",
    explorer: "https://arbiscan.io"
  },
  {
    id: 10, chain: optimism, name: "Optimism", icon: "🔴",
    rpc: "https://opt-mainnet.g.alchemy.com/v2/demo",
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

export async function GET() {
  const allAgents: AgentStats[] = [];

  // Process chains sequentially with multicall
  for (const chainConfig of CHAINS) {
    const client = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpc),
      batch: { multicall: true },
    });

    try {
      // Get total bot count first
      const nextBotId = await client.readContract({
        address: chainConfig.botRegistry as `0x${string}`,
        abi: BOT_REGISTRY_ABI,
        functionName: "nextBotId",
      });

      const botCount = Number(nextBotId) - 1;
      if (botCount <= 0) continue;

      // Build multicall requests for all bots at once
      const contracts: {
        address: `0x${string}`;
        abi: typeof BOT_REGISTRY_ABI | typeof CREDIT_SCORING_ABI;
        functionName: string;
        args: [bigint];
      }[] = [];

      for (let botId = 1; botId <= botCount; botId++) {
        contracts.push({
          address: chainConfig.botRegistry as `0x${string}`,
          abi: BOT_REGISTRY_ABI,
          functionName: "getBot",
          args: [BigInt(botId)],
        });
        contracts.push({
          address: chainConfig.creditScoring as `0x${string}`,
          abi: CREDIT_SCORING_ABI,
          functionName: "getBasicStats",
          args: [BigInt(botId)],
        });
        contracts.push({
          address: chainConfig.creditScoring as `0x${string}`,
          abi: CREDIT_SCORING_ABI,
          functionName: "getCreditScore",
          args: [BigInt(botId)],
        });
        contracts.push({
          address: chainConfig.creditScoring as `0x${string}`,
          abi: CREDIT_SCORING_ABI,
          functionName: "getVolumeStats",
          args: [BigInt(botId)],
        });
      }

      // Execute all reads in a single multicall
      const results = await client.multicall({ contracts });

      // Parse results (4 results per bot)
      for (let i = 0; i < botCount; i++) {
        const botId = i + 1;
        const baseIdx = i * 4;

        const botInfoResult = results[baseIdx];
        const basicStatsResult = results[baseIdx + 1];
        const creditScoreResult = results[baseIdx + 2];
        const volumeStatsResult = results[baseIdx + 3];

        if (
          botInfoResult.status === "success" &&
          basicStatsResult.status === "success" &&
          creditScoreResult.status === "success" &&
          volumeStatsResult.status === "success"
        ) {
          const botInfo = botInfoResult.result as [string, string, bigint, boolean];
          const basicStats = basicStatsResult.result as [bigint, bigint, bigint, bigint, bigint];
          const creditScore = creditScoreResult.result as bigint;
          const volumeStats = volumeStatsResult.result as [bigint, bigint, bigint, bigint];

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
        } else {
          // Add with defaults on failure
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
