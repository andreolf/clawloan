import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST /api/borrow - Request a micro-loan
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

    // Verify bot exists and is active
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { permissions: true, loans: { where: { status: "ACTIVE" } } },
    });

    if (!bot) {
      return NextResponse.json(
        { error: "Bot not found" },
        { status: 404 }
      );
    }

    if (!bot.active) {
      return NextResponse.json(
        { error: "Bot is not active" },
        { status: 403 }
      );
    }

    // Check permissions
    if (!bot.permissions || bot.permissions.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "No active permissions for this bot" },
        { status: 403 }
      );
    }

    // Check max spend
    const maxSpend = BigInt(bot.permissions.maxSpend);
    const requestedAmount = BigInt(amount);

    if (requestedAmount > maxSpend) {
      return NextResponse.json(
        { error: "Amount exceeds max borrow limit" },
        { status: 400 }
      );
    }

    // Check for existing active loan
    if (bot.loans.length > 0) {
      return NextResponse.json(
        { error: "Bot already has an active loan" },
        { status: 400 }
      );
    }

    // Get current pool stats
    const stats = await prisma.poolStats.findFirst({ where: { id: "main" } });
    if (!stats) {
      return NextResponse.json(
        { error: "Pool not initialized" },
        { status: 500 }
      );
    }

    // Check liquidity
    const available = BigInt(stats.totalDeposits) - BigInt(stats.totalBorrows);
    if (requestedAmount > available) {
      return NextResponse.json(
        { error: "Insufficient liquidity in pool" },
        { status: 400 }
      );
    }

    // Create loan
    const now = new Date();
    const loan = await prisma.loan.create({
      data: {
        botId,
        principal: amount,
        interestIndex: stats.borrowIndex,
        startTime: now,
        lastAccruedTime: now,
        status: "ACTIVE",
      },
    });

    // Update pool stats
    await prisma.poolStats.update({
      where: { id: "main" },
      data: {
        totalBorrows: (BigInt(stats.totalBorrows) + requestedAmount).toString(),
        lastUpdated: now,
      },
    });

    return NextResponse.json({
      loan,
      message: "Loan created successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating loan:", error);
    return NextResponse.json(
      { error: "Failed to create loan" },
      { status: 500 }
    );
  }
}
