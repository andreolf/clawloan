import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/pools - Get pool statistics
export async function GET() {
  try {
    const stats = await prisma.poolStats.findFirst({
      where: { id: "main" },
    });

    if (!stats) {
      return NextResponse.json({
        totalDeposits: "0",
        totalBorrows: "0",
        utilization: 0,
        supplyAPY: 0,
        borrowAPR: 0,
        activeLoans: 0,
        rewardPool: "0",
      });
    }

    // Calculate rates
    const totalDeposits = BigInt(stats.totalDeposits);
    const totalBorrows = BigInt(stats.totalBorrows);

    const utilization = totalDeposits > 0n
      ? Number(totalBorrows * 10000n / totalDeposits) / 10000
      : 0;

    // Simple interest model: 2% base + 4% * util/0.8 below optimal
    const baseRate = 0.02;
    const slope1 = 0.04;
    const optimalUtil = 0.8;

    let borrowAPR: number;
    if (utilization <= optimalUtil) {
      borrowAPR = baseRate + slope1 * (utilization / optimalUtil);
    } else {
      const slope2 = 0.75;
      borrowAPR = baseRate + slope1 + slope2 * ((utilization - optimalUtil) / (1 - optimalUtil));
    }

    const reserveFactor = 0.1; // 10%
    const supplyAPY = borrowAPR * (1 - reserveFactor) * utilization;

    // Count active loans
    const activeLoans = await prisma.loan.count({
      where: { status: "ACTIVE" },
    });

    return NextResponse.json({
      totalDeposits: stats.totalDeposits,
      totalBorrows: stats.totalBorrows,
      totalShares: stats.totalShares,
      utilization,
      supplyAPY,
      borrowAPR,
      activeLoans,
      rewardPool: stats.rewardPool,
      rewardIndex: stats.rewardIndex,
      lastUpdated: stats.lastUpdated,
    });
  } catch (error) {
    console.error("Error fetching pool stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool statistics" },
      { status: 500 }
    );
  }
}
