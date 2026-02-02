import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { base, arbitrum, optimism } from "viem/chains";

const CHAINS = [
  { 
    id: 8453, 
    chain: base, 
    name: "Base",
    rpc: "https://mainnet.base.org",
    lendingPool: "0x3Dca46B18D3a49f36311fb7A9b444B6041241906" as `0x${string}`,
    botRegistry: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A" as `0x${string}`,
  },
  { 
    id: 42161, 
    chain: arbitrum, 
    name: "Arbitrum",
    rpc: "https://arb1.arbitrum.io/rpc",
    lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09" as `0x${string}`,
    botRegistry: "0xe19320FB36d07CCBC14b239453F36Ed958DeDEF0" as `0x${string}`,
  },
  { 
    id: 10, 
    chain: optimism, 
    name: "Optimism",
    rpc: "https://mainnet.optimism.io",
    lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09" as `0x${string}`,
    botRegistry: "0xe19320FB36d07CCBC14b239453F36Ed958DeDEF0" as `0x${string}`,
  },
];

const LENDING_POOL_ABI = [
  {
    name: "totalDeposits",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalBorrows",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const BOT_REGISTRY_ABI = [
  {
    name: "nextBotId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// GET /api/stats - Get comprehensive protocol stats from on-chain
export async function GET() {
  try {
    let totalDeposits = 0n;
    let totalBorrows = 0n;
    let totalBots = 0;

    const chainStats = await Promise.all(
      CHAINS.map(async (chainConfig) => {
        const client = createPublicClient({
          chain: chainConfig.chain,
          transport: http(chainConfig.rpc),
        });

        try {
          const [deposits, borrows, nextBotId] = await Promise.all([
            client.readContract({
              address: chainConfig.lendingPool,
              abi: LENDING_POOL_ABI,
              functionName: "totalDeposits",
            }),
            client.readContract({
              address: chainConfig.lendingPool,
              abi: LENDING_POOL_ABI,
              functionName: "totalBorrows",
            }),
            client.readContract({
              address: chainConfig.botRegistry,
              abi: BOT_REGISTRY_ABI,
              functionName: "nextBotId",
            }),
          ]);

          totalDeposits += deposits;
          totalBorrows += borrows;
          totalBots += Number(nextBotId) - 1; // nextBotId starts at 1

          return {
            chainId: chainConfig.id,
            chainName: chainConfig.name,
            tvl: formatUnits(deposits, 6),
            borrows: formatUnits(borrows, 6),
            bots: Number(nextBotId) - 1,
          };
        } catch (err) {
          console.error(`Error fetching from ${chainConfig.name}:`, err);
          return {
            chainId: chainConfig.id,
            chainName: chainConfig.name,
            error: "Failed to fetch",
          };
        }
      })
    );

    const utilization = totalDeposits > 0n
      ? Number((totalBorrows * 10000n) / totalDeposits) / 100
      : 0;

    // Calculate rates
    const baseRate = 2;
    const slope1 = 4;
    const optimalUtil = 80;

    let borrowAPR: number;
    if (utilization <= optimalUtil) {
      borrowAPR = baseRate + (slope1 * utilization / optimalUtil);
    } else {
      borrowAPR = baseRate + slope1 + (75 * (utilization - optimalUtil) / (100 - optimalUtil));
    }
    const supplyAPY = (borrowAPR * 0.9 * utilization) / 100;

    return NextResponse.json({
      protocol: {
        tvl: formatUnits(totalDeposits, 6),
        totalBorrows: formatUnits(totalBorrows, 6),
        utilization: utilization.toFixed(2) + "%",
        supplyAPY: supplyAPY.toFixed(2) + "%",
        borrowAPR: borrowAPR.toFixed(2) + "%",
      },
      bots: {
        total: totalBots,
      },
      chains: chainStats,
      supportedChains: CHAINS.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
