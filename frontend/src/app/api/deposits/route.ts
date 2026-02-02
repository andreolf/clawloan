import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { base, arbitrum, optimism } from "viem/chains";

const CHAINS = [
  { 
    id: 8453, 
    chain: base, 
    name: "Base",
    rpc: "https://mainnet.base.org",
    lendingPool: "0x3Dca46B18D3a49f36311fb7A9b444B6041241906" as `0x${string}`,
  },
  { 
    id: 42161, 
    chain: arbitrum, 
    name: "Arbitrum",
    rpc: "https://arb1.arbitrum.io/rpc",
    lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09" as `0x${string}`,
  },
  { 
    id: 10, 
    chain: optimism, 
    name: "Optimism",
    rpc: "https://mainnet.optimism.io",
    lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09" as `0x${string}`,
  },
];

const LENDING_POOL_ABI = [
  {
    name: "deposits",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "depositor", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    name: "shares",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "depositor", type: "address" }],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    name: "totalDeposits",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "totalShares",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// GET /api/deposits?address=0x... - Get deposit positions across all chains
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get("address");

  if (!address) {
    return NextResponse.json(
      { error: "Missing required query parameter: address" },
      { status: 400 }
    );
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid address format" },
      { status: 400 }
    );
  }

  try {
    const positions = await Promise.all(
      CHAINS.map(async (chainConfig) => {
        const client = createPublicClient({
          chain: chainConfig.chain,
          transport: http(chainConfig.rpc),
        });

        try {
          const [deposits, shares, totalDeposits, totalShares] = await Promise.all([
            client.readContract({
              address: chainConfig.lendingPool,
              abi: LENDING_POOL_ABI,
              functionName: "deposits",
              args: [address as `0x${string}`],
            }),
            client.readContract({
              address: chainConfig.lendingPool,
              abi: LENDING_POOL_ABI,
              functionName: "shares",
              args: [address as `0x${string}`],
            }),
            client.readContract({
              address: chainConfig.lendingPool,
              abi: LENDING_POOL_ABI,
              functionName: "totalDeposits",
            }),
            client.readContract({
              address: chainConfig.lendingPool,
              abi: LENDING_POOL_ABI,
              functionName: "totalShares",
            }),
          ]);

          // Calculate current value based on share ratio
          const shareValue = totalShares > 0n
            ? (shares * totalDeposits) / totalShares
            : 0n;

          return {
            chainId: chainConfig.id,
            chainName: chainConfig.name,
            lendingPool: chainConfig.lendingPool,
            deposited: formatUnits(deposits, 6),
            shares: shares.toString(),
            currentValue: formatUnits(shareValue, 6),
            poolShare: totalShares > 0n 
              ? ((Number(shares) / Number(totalShares)) * 100).toFixed(4)
              : "0",
          };
        } catch (err) {
          console.error(`Error fetching from ${chainConfig.name}:`, err);
          return {
            chainId: chainConfig.id,
            chainName: chainConfig.name,
            lendingPool: chainConfig.lendingPool,
            deposited: "0",
            shares: "0",
            currentValue: "0",
            poolShare: "0",
            error: "Failed to fetch",
          };
        }
      })
    );

    // Calculate totals
    const totalDeposited = positions.reduce(
      (sum, p) => sum + parseFloat(p.deposited || "0"),
      0
    );
    const totalValue = positions.reduce(
      (sum, p) => sum + parseFloat(p.currentValue || "0"),
      0
    );

    return NextResponse.json({
      address,
      positions,
      totals: {
        deposited: totalDeposited.toFixed(2),
        currentValue: totalValue.toFixed(2),
        earnings: (totalValue - totalDeposited).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error fetching deposits:", error);
    return NextResponse.json(
      { error: "Failed to fetch deposit positions" },
      { status: 500 }
    );
  }
}
