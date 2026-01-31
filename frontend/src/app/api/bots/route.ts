import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/bots - List bots (optionally filter by operator)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operator = searchParams.get("operator");

    const where = operator ? { operatorAddress: operator } : {};

    const bots = await prisma.bot.findMany({
      where,
      include: {
        permissions: true,
        loans: {
          where: { status: "ACTIVE" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ bots });
  } catch (error) {
    console.error("Error fetching bots:", error);
    return NextResponse.json(
      { error: "Failed to fetch bots" },
      { status: 500 }
    );
  }
}

// POST /api/bots - Register a new bot
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, tags, operatorAddress, metadataHash, maxBorrowLimit } = body;

    if (!name || !operatorAddress) {
      return NextResponse.json(
        { error: "Name and operator address are required" },
        { status: 400 }
      );
    }

    // Create bot
    const bot = await prisma.bot.create({
      data: {
        name,
        description: description || null,
        tags: JSON.stringify(tags || []),
        operatorAddress,
        metadataHash: metadataHash || null,
        active: true,
      },
    });

    // Always create default permissions (use provided limit or default)
    const borrowLimit = maxBorrowLimit || "1000000000"; // Default 1000 USDC
    await prisma.permission.create({
      data: {
        botId: bot.id,
        permissionsHash: "0x" + "0".repeat(64), // Placeholder
        permissionsJson: JSON.stringify({
          scope: {
            allowedCategories: tags || [],
            maxSpendPerTx: borrowLimit,
            maxTotalSpend: borrowLimit,
            allowedDestinations: [],
          },
          delegation: {
            delegator: operatorAddress,
            expiry: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
            emergencyRevoke: true,
          },
        }),
        maxSpend: borrowLimit,
        expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ bot }, { status: 201 });
  } catch (error) {
    console.error("Error creating bot:", error);
    return NextResponse.json(
      { error: "Failed to create bot" },
      { status: 500 }
    );
  }
}
