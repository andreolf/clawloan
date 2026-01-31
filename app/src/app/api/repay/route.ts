import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/repay - Repay a loan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { botId, amount } = body;

    if (!botId || !amount) {
      return NextResponse.json(
        { error: "Bot ID and amount are required" },
        { status: 400 }
      );
    }

    // Find active loan
    const loan = await prisma.loan.findFirst({
      where: { botId, status: "ACTIVE" },
    });

    if (!loan) {
      return NextResponse.json(
        { error: "No active loan found for this bot" },
        { status: 404 }
      );
    }

    // Get pool stats
    const stats = await prisma.poolStats.findFirst({ where: { id: "main" } });
    if (!stats) {
      return NextResponse.json(
        { error: "Pool not initialized" },
        { status: 500 }
      );
    }

    // Calculate interest owed (simplified)
    const principal = BigInt(loan.principal);
    const startIndex = BigInt(loan.interestIndex);
    const currentIndex = BigInt(stats.borrowIndex);

    // Interest = principal * (currentIndex / startIndex - 1)
    const interestMultiplier = (currentIndex * BigInt(1e18)) / startIndex;
    const totalOwed = (principal * interestMultiplier) / BigInt(1e18);
    const interest = totalOwed - principal;

    const repayAmount = BigInt(amount);
    if (repayAmount < totalOwed) {
      return NextResponse.json(
        {
          error: "Insufficient repayment amount",
          required: totalOwed.toString(),
          provided: amount,
        },
        { status: 400 }
      );
    }

    // Update loan status
    await prisma.loan.update({
      where: { id: loan.id },
      data: { status: "REPAID", lastAccruedTime: new Date() },
    });

    // Update pool stats - reduce borrows, add interest to deposits
    const reserveFactor = BigInt(1000); // 10%
    const reserveAmount = (interest * reserveFactor) / BigInt(10000);
    const depositIncrease = interest - reserveAmount;

    await prisma.poolStats.update({
      where: { id: "main" },
      data: {
        totalBorrows: (BigInt(stats.totalBorrows) - principal).toString(),
        totalDeposits: (BigInt(stats.totalDeposits) + depositIncrease).toString(),
        lastUpdated: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      principal: principal.toString(),
      interest: interest.toString(),
      totalRepaid: repayAmount.toString(),
    });
  } catch (error) {
    console.error("Error repaying loan:", error);
    return NextResponse.json(
      { error: "Failed to repay loan" },
      { status: 500 }
    );
  }
}

// POST /api/repay-with-profit - Repay with profit sharing
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { botId, repayAmount, profitAmount } = body;

    if (!botId || !repayAmount) {
      return NextResponse.json(
        { error: "Bot ID and repay amount are required" },
        { status: 400 }
      );
    }

    // Find active loan
    const loan = await prisma.loan.findFirst({
      where: { botId, status: "ACTIVE" },
    });

    if (!loan) {
      return NextResponse.json(
        { error: "No active loan found for this bot" },
        { status: 404 }
      );
    }

    // Get pool stats
    const stats = await prisma.poolStats.findFirst({ where: { id: "main" } });
    if (!stats) {
      return NextResponse.json(
        { error: "Pool not initialized" },
        { status: 500 }
      );
    }

    const principal = BigInt(loan.principal);

    // Calculate profit share (5%)
    const profit = BigInt(profitAmount || "0");
    const profitShareBps = BigInt(500); // 5%
    const profitShare = (profit * profitShareBps) / BigInt(10000);

    // Update loan status
    await prisma.loan.update({
      where: { id: loan.id },
      data: { status: "REPAID", lastAccruedTime: new Date() },
    });

    // Update pool stats with profit share going to reward pool
    await prisma.poolStats.update({
      where: { id: "main" },
      data: {
        totalBorrows: (BigInt(stats.totalBorrows) - principal).toString(),
        rewardPool: (BigInt(stats.rewardPool) + profitShare).toString(),
        lastUpdated: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      principal: principal.toString(),
      profitShared: profitShare.toString(),
      message: "Loan repaid with profit sharing",
    });
  } catch (error) {
    console.error("Error repaying loan with profit:", error);
    return NextResponse.json(
      { error: "Failed to repay loan" },
      { status: 500 }
    );
  }
}
