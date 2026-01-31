import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/stats - Get comprehensive protocol stats
export async function GET() {
  try {
    const [poolStats, bots, loans, deposits] = await Promise.all([
      prisma.poolStats.findFirst(),
      prisma.bot.findMany({
        select: {
          id: true,
          active: true,
          createdAt: true,
        },
      }),
      prisma.loan.findMany({
        select: {
          principal: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.deposit.findMany({
        select: {
          amount: true,
          createdAt: true,
        },
      }),
    ]);

    // Calculate stats
    const totalBots = bots.length;
    const activeBots = bots.filter((b) => b.active).length;
    const totalLoans = loans.length;
    const activeLoans = loans.filter((l) => l.status === "ACTIVE").length;
    const repaidLoans = loans.filter((l) => l.status === "REPAID").length;

    const totalBorrowed = loans.reduce(
      (sum, l) => sum + BigInt(l.principal),
      BigInt(0)
    );

    const totalDeposited = deposits.reduce(
      (sum, d) => sum + BigInt(d.amount),
      BigInt(0)
    );

    // Daily stats (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentLoans = loans.filter((l) => l.createdAt > sevenDaysAgo).length;
    const recentBots = bots.filter((b) => b.createdAt > sevenDaysAgo).length;

    // Calculate utilization and rates
    const tvl = BigInt(poolStats?.totalDeposits || "0");
    const borrows = BigInt(poolStats?.totalBorrows || "0");
    const utilization = tvl > 0 ? Number((borrows * BigInt(10000)) / tvl) / 100 : 0;
    
    // Simple rate calculation (matches contract logic)
    const baseRate = 2; // 2%
    const slope1 = 4;   // 4%
    const optimalUtil = 80;
    const borrowAPR = utilization <= optimalUtil 
      ? baseRate + (slope1 * utilization / optimalUtil)
      : baseRate + slope1 + (75 * (utilization - optimalUtil) / (100 - optimalUtil));
    const supplyAPY = (borrowAPR * 0.9 * utilization) / 100; // 90% to lenders

    return NextResponse.json({
      protocol: {
        tvl: poolStats?.totalDeposits || "0",
        totalBorrows: poolStats?.totalBorrows || "0",
        utilization,
        supplyAPY: supplyAPY.toFixed(2) + "%",
        borrowAPR: borrowAPR.toFixed(2) + "%",
      },
      bots: {
        total: totalBots,
        active: activeBots,
        newLast7Days: recentBots,
      },
      loans: {
        total: totalLoans,
        active: activeLoans,
        repaid: repaidLoans,
        defaulted: totalLoans - activeLoans - repaidLoans,
        newLast7Days: recentLoans,
        totalVolumeUSDC: (totalBorrowed / BigInt(1e6)).toString(),
      },
      deposits: {
        count: deposits.length,
        totalVolumeUSDC: (totalDeposited / BigInt(1e6)).toString(),
      },
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
