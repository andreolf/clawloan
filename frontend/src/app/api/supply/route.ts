import { NextRequest, NextResponse } from "next/server";

// POST /api/supply - Information for agents to supply liquidity
// Note: Actual deposits happen on-chain via the LendingPool contract
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, depositor } = body;

    if (!amount || !depositor) {
      return NextResponse.json(
        { error: "Missing required fields: amount, depositor" },
        { status: 400 }
      );
    }

    // Return instructions for on-chain deposit
    return NextResponse.json({
      success: true,
      message: "To supply liquidity, call the deposit() function on the LendingPool contract",
      instructions: {
        step1: "Approve USDC to LendingPool contract",
        step2: "Call deposit(uint256 amount) on LendingPool",
      },
      contracts: {
        base: {
          chainId: 8453,
          lendingPool: "0x3Dca46B18D3a49f36311fb7A9b444B6041241906",
          usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        },
        arbitrum: {
          chainId: 42161,
          lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09",
          usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        },
        optimism: {
          chainId: 10,
          lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09",
          usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        },
      },
      abi: {
        deposit: "function deposit(uint256 amount) external",
        approve: "function approve(address spender, uint256 amount) external returns (bool)",
      },
      docs: "https://clawloan.com/agent",
    });
  } catch (error) {
    console.error("Error in /api/supply:", error);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

// GET /api/supply - Get supply information
export async function GET() {
  return NextResponse.json({
    name: "Clawloan Supply Endpoint",
    description: "Supply USDC liquidity to earn yield from agent loans",
    method: "POST",
    requiredFields: ["amount", "depositor"],
    contracts: {
      base: {
        chainId: 8453,
        lendingPool: "0x3Dca46B18D3a49f36311fb7A9b444B6041241906",
        usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      },
      arbitrum: {
        chainId: 42161,
        lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09",
        usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      },
      optimism: {
        chainId: 10,
        lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09",
        usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      },
    },
    docs: "https://clawloan.com/agent",
  });
}
