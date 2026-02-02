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
  },
  { 
    id: 42161, 
    chain: arbitrum, 
    name: "Arbitrum",
    rpc: "https://arb1.arbitrum.io/rpc",
    lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09" as `0x${string}`,
  },
  { 
    id: 10, 
    chain: optimism, 
    name: "Optimism",
    rpc: "https://mainnet.optimism.io",
    lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09" as `0x${string}`,
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

// GET /api/pools - Get pool statistics from all chains
export async function GET() {
  try {
    const poolData = await Promise.all(
      CHAINS.map(async (chainConfig) => {
        const client = createPublicClient({
          chain: chainConfig.chain,
          transport: http(chainConfig.rpc),
        });

        try {
          const [totalDeposits, totalBorrows] = await Promise.all([
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
          ]);

          const utilization = totalDeposits > 0n
            ? Number((totalBorrows * 10000n) / totalDeposits) / 100
            : 0;

          // Simple interest model
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

          return {
            chainId: chainConfig.id,
            chainName: chainConfig.name,
            lendingPool: chainConfig.lendingPool,
            totalDeposits: formatUnits(totalDeposits, 6),
            totalBorrows: formatUnits(totalBorrows, 6),
            utilization: utilization.toFixed(2) + "%",
            supplyAPY: supplyAPY.toFixed(2) + "%",
            borrowAPR: borrowAPR.toFixed(2) + "%",
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

    // Calculate totals
    const totalDeposits = poolData.reduce(
      (sum, p) => sum + parseFloat(p.totalDeposits || "0"),
      0
    );
    const totalBorrows = poolData.reduce(
      (sum, p) => sum + parseFloat(p.totalBorrows || "0"),
      0
    );
    const utilization = totalDeposits > 0 ? (totalBorrows / totalDeposits) * 100 : 0;

    return NextResponse.json({
      pools: poolData,
      totals: {
        totalDeposits: totalDeposits.toFixed(2),
        totalBorrows: totalBorrows.toFixed(2),
        utilization: utilization.toFixed(2) + "%",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching pool stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool statistics" },
      { status: 500 }
    );
  }
}
