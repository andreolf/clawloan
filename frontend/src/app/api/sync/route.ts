import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { baseSepolia } from "viem/chains";
import { prisma } from "@/lib/prisma";

// Contract addresses on Base Sepolia
const LENDING_POOL = "0x88EE97C470b275b3780972007d1Ba5Cf195A5DD9";

// Minimal ABI for reading pool state
const LENDING_POOL_ABI = [
  {
    name: "totalDeposits",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalBorrows",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getUtilization",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getSupplyRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "getBorrowRate",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Create viem client for Base Sepolia
const client = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

export async function GET() {
  try {
    // Read on-chain data
    const [totalDeposits, totalBorrows, utilization, supplyRate, borrowRate] = await Promise.all([
      client.readContract({
        address: LENDING_POOL,
        abi: LENDING_POOL_ABI,
        functionName: "totalDeposits",
      }),
      client.readContract({
        address: LENDING_POOL,
        abi: LENDING_POOL_ABI,
        functionName: "totalBorrows",
      }),
      client.readContract({
        address: LENDING_POOL,
        abi: LENDING_POOL_ABI,
        functionName: "getUtilization",
      }),
      client.readContract({
        address: LENDING_POOL,
        abi: LENDING_POOL_ABI,
        functionName: "getSupplyRate",
      }),
      client.readContract({
        address: LENDING_POOL,
        abi: LENDING_POOL_ABI,
        functionName: "getBorrowRate",
      }),
    ]);

    // Format values
    const tvl = formatUnits(totalDeposits, 6);
    const borrowed = formatUnits(totalBorrows, 6);
    const util = Number(utilization) / 1e27 * 100; // RAY to percentage
    const supplyAPY = Number(supplyRate) / 1e27 * 100;
    const borrowAPR = Number(borrowRate) / 1e27 * 100;

    // Update database
    await prisma.poolStats.upsert({
      where: { id: "main" },
      update: {
        totalDeposits: tvl,
        totalBorrows: borrowed,
        lastUpdated: new Date(),
      },
      create: {
        id: "main",
        totalDeposits: tvl,
        totalBorrows: borrowed,
        rewardPool: "0",
      },
    });

    return NextResponse.json({
      success: true,
      synced: {
        totalDeposits: tvl,
        totalBorrows: borrowed,
        utilization: util.toFixed(2),
        supplyAPY: supplyAPY.toFixed(2),
        borrowAPR: borrowAPR.toFixed(2),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync", details: String(error) },
      { status: 500 }
    );
  }
}

// POST to trigger sync (for cron jobs)
export async function POST() {
  return GET();
}
