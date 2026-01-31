import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/loans - Get loans (optionally filter by botId)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const botId = searchParams.get("botId");

    const where = botId ? { botId } : {};

    const loans = await prisma.loan.findMany({
      where,
      include: {
        bot: {
          select: {
            id: true,
            name: true,
            operatorAddress: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate interest owed for each loan
    const stats = await prisma.poolStats.findFirst({ where: { id: "main" } });
    const currentIndex = stats ? BigInt(stats.borrowIndex) : BigInt(1e27);

    const loansWithInterest = loans.map((loan) => {
      if (loan.status !== "ACTIVE") {
        return {
          ...loan,
          interestOwed: "0",
          totalOwed: loan.principal,
        };
      }

      const principal = BigInt(loan.principal);
      const startIndex = BigInt(loan.interestIndex);
      const interestMultiplier = (currentIndex * BigInt(1e18)) / startIndex;
      const totalOwed = (principal * interestMultiplier) / BigInt(1e18);
      const interestOwed = totalOwed - principal;

      return {
        ...loan,
        interestOwed: interestOwed.toString(),
        totalOwed: totalOwed.toString(),
      };
    });

    return NextResponse.json({ loans: loansWithInterest });
  } catch (error) {
    console.error("Error fetching loans:", error);
    return NextResponse.json(
      { error: "Failed to fetch loans" },
      { status: 500 }
    );
  }
}
