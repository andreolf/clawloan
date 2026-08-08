import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// Base per-call price for the x402 endpoint (0.10 USDC, 6 decimals).
const BASE_COST = "100000";

// x402 payment authorization check.
//
// Previously this was a MOCK that accepted ANY non-empty X-Payment-402 header.
// Now the caller must present a payment *authorization* signed by the bot's
// on-record operator, binding the amount + a fresh timestamp, which we verify
// against the recovered signer.
//
// NOTE: this authorizes (and meters) the charge but does not yet SETTLE it
// on-chain. Real x402 settlement requires either an EIP-3009 transferWithAuth
// submitted to a facilitator, or an on-chain USDC transfer verified by tx hash.
// The metered `totalOwed` is the amount that must then be collected on-chain.
async function validateX402Payment(
  headers: Headers
): Promise<{ valid: true; botId: string; operator: string } | { valid: false; status: number; error: string }> {
  const botId = headers.get("X-Bot-Id");
  const paymentHeader = headers.get("X-Payment-402");

  if (!botId) {
    return { valid: false, status: 400, error: "Bot ID required - include X-Bot-Id header" };
  }
  if (!paymentHeader) {
    return { valid: false, status: 402, error: "Payment required - include signed X-Payment-402 header" };
  }

  // X-Payment-402 is a base64url-encoded JSON auth envelope: { address, timestamp, signature }.
  let auth: unknown;
  try {
    auth = JSON.parse(Buffer.from(paymentHeader, "base64url").toString("utf-8"));
  } catch {
    return { valid: false, status: 402, error: "Malformed X-Payment-402 payment authorization" };
  }

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot) {
    return { valid: false, status: 404, error: "Bot not found" };
  }

  const result = await verifyAuth({
    action: "x402-pay",
    params: { botId, endpoint: "/api/task", amount: BASE_COST },
    auth: auth as never,
    expectedAddress: bot.operatorAddress,
  });
  if (!result.ok) {
    return { valid: false, status: result.status === 403 ? 402 : result.status, error: result.error };
  }

  return { valid: true, botId, operator: bot.operatorAddress };
}

// POST /api/task - x402 protected endpoint
export async function POST(request: NextRequest) {
  try {
    // Validate the signed x402 payment authorization (verifies the bot exists
    // and the signer is its operator).
    const validation = await validateX402Payment(request.headers);

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const botId = validation.botId;

    // Get request body
    const body = await request.json().catch(() => ({}));
    const taskType = body.task || "default";

    // Per-call cost (0.10 USDC).
    const baseCost = BigInt(BASE_COST);

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
