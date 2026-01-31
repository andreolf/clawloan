import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Mock x402 payment validation
function validateX402Payment(headers: Headers): { valid: boolean; botId?: string; error?: string } {
  const paymentHeader = headers.get("X-Payment-402");
  const botIdHeader = headers.get("X-Bot-Id");

  if (!paymentHeader) {
    return { valid: false, error: "Payment required - include X-Payment-402 header" };
  }

  if (!botIdHeader) {
    return { valid: false, error: "Bot ID required - include X-Bot-Id header" };
  }

  return { valid: true, botId: botIdHeader };
}

// POST /api/task - x402 protected endpoint
export async function POST(request: NextRequest) {
  try {
    // Validate x402 payment
    const validation = validateX402Payment(request.headers);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 402 }
      );
    }

    const botId = validation.botId!;

    // Verify bot exists
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
    });

    if (!bot) {
      return NextResponse.json(
        { error: "Bot not found" },
        { status: 404 }
      );
    }

    // Get request body
    const body = await request.json().catch(() => ({}));
    const taskType = body.task || "default";

    // Calculate cost (mock pricing)
    const baseCost = BigInt("100000"); // 0.10 USDC per call

    // Check if usage record exists
    const existingUsage = await prisma.usage.findUnique({
      where: {
        botId_endpoint: {
          botId,
          endpoint: "/api/task",
        },
      },
    });

    if (existingUsage) {
      // Update existing usage
      const newTotal = BigInt(existingUsage.totalOwed) + baseCost;
      await prisma.usage.update({
        where: { id: existingUsage.id },
        data: {
          calls: existingUsage.calls + 1,
          totalOwed: newTotal.toString(),
          lastCallAt: new Date(),
        },
      });
    } else {
      // Create new usage record
      await prisma.usage.create({
        data: {
          botId,
          endpoint: "/api/task",
          calls: 1,
          totalOwed: baseCost.toString(),
          lastCallAt: new Date(),
        },
      });
    }

    // Simulate task execution
    const result = {
      success: true,
      task: taskType,
      cost: baseCost.toString(),
      timestamp: new Date().toISOString(),
      data: {
        message: `Task "${taskType}" completed successfully`,
        executionTime: Math.floor(Math.random() * 1000) + 100,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error executing task:", error);
    return NextResponse.json(
      { error: "Task execution failed" },
      { status: 500 }
    );
  }
}

// GET /api/task - Get task pricing and info
export async function GET() {
  return NextResponse.json({
    name: "Clawloan x402 Task Endpoint",
    description: "Pay-per-request task execution for AI agents",
    pricing: {
      baseCost: "100000",
      currency: "USDC",
      decimals: 6,
    },
    headers: {
      required: ["X-Payment-402", "X-Bot-Id"],
    },
  });
}
