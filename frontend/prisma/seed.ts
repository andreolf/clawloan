import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create pool stats
  await prisma.poolStats.upsert({
    where: { id: "main" },
    update: {},
    create: {
      id: "main",
      totalDeposits: "1200000000000", // 1.2M USDC (6 decimals)
      totalBorrows: "890000000000", // 890K USDC
      totalShares: "1180000000000", // Shares
      borrowIndex: "1020000000000000000000000000", // ~1.02e27 (some interest accrued)
      rewardPool: "5000000000", // 5K USDC in rewards
      rewardIndex: "4237288135593220000", // Some reward accumulation
    },
  });

  // Create demo bot
  const bot = await prisma.bot.upsert({
    where: { id: "demo-trading-bot" },
    update: {},
    create: {
      id: "demo-trading-bot",
      onchainId: 1,
      name: "TradingBot",
      description: "Autonomous trading agent for arbitrage opportunities",
      tags: JSON.stringify(["trading", "arbitrage", "defi"]),
      operatorAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Anvil account 1
      metadataHash: "ipfs://QmDemo123456789",
      active: true,
    },
  });

  // Create demo permission
  await prisma.permission.upsert({
    where: { botId: bot.id },
    update: {},
    create: {
      botId: bot.id,
      permissionsHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      permissionsJson: JSON.stringify({
        scope: {
          allowedCategories: ["trading", "api_calls"],
          maxSpendPerTx: "100000000", // 100 USDC
          maxTotalSpend: "1000000000", // 1000 USDC
          allowedDestinations: [],
        },
        delegation: {
          delegator: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          expiry: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
          emergencyRevoke: true,
        },
      }),
      maxSpend: "1000000000", // 1000 USDC
      expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });

  // Create demo loan
  await prisma.loan.upsert({
    where: { id: "demo-loan-1" },
    update: {},
    create: {
      id: "demo-loan-1",
      botId: bot.id,
      principal: "500000000", // 500 USDC
      interestIndex: "1020000000000000000000000000", // Same as pool
      startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      lastAccruedTime: new Date(),
      status: "ACTIVE",
    },
  });

  // Create demo deposit
  await prisma.deposit.upsert({
    where: { id: "demo-deposit-1" },
    update: {},
    create: {
      id: "demo-deposit-1",
      lenderAddress: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Anvil account 0
      amount: "10000000000", // 10,000 USDC
      shares: "9850000000", // Slightly fewer shares due to yield
      rewardDebt: "0",
    },
  });

  // Create demo usage
  await prisma.usage.upsert({
    where: { id: "demo-usage-1" },
    update: {},
    create: {
      id: "demo-usage-1",
      botId: bot.id,
      endpoint: "/api/task",
      calls: 127,
      totalOwed: "12500000", // 12.50 USDC
      lastCallAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
  });

  console.log("Seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
