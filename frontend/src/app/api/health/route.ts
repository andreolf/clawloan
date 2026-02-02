import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/health - Health check endpoint
export async function GET() {
  const start = Date.now();

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Get basic stats
    const [botCount, loanCount, poolStats] = await Promise.all([
      prisma.bot.count(),
      prisma.loan.count({ where: { status: "ACTIVE" } }),
      prisma.poolStats.findFirst(),
    ]);

    const latency = Date.now() - start;

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      latency: `${latency}ms`,
      database: "connected",
      stats: {
        totalBots: botCount,
        activeLoans: loanCount,
        tvl: poolStats?.totalDeposits || "0",
      },
      version: "1.0.0",
      chain: {
        supported: ["base", "arbitrum", "optimism"],
        default: "base",
      },
    });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        latency: `${Date.now() - start}ms`,
        database: "disconnected",
        error: "Database connection failed",
      },
      { status: 503 }
    );
  }
}
