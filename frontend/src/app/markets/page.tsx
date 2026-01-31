"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { baseSepolia } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { CONTRACT_ADDRESSES } from "@/config/wagmi";
import { LENDING_POOL_ABI } from "@/lib/contracts";

// Fixed address for Base Sepolia
const POOL_ADDRESS = CONTRACT_ADDRESSES[84532].lendingPool;

export default function MarketsPage() {
  // Read pool stats from Base Sepolia
  const { data: totalDeposits } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "totalDeposits",
    chainId: baseSepolia.id,
  });

  const { data: totalBorrows } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "totalBorrows",
    chainId: baseSepolia.id,
  });

  const { data: supplyRate } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "getSupplyRate",
    chainId: baseSepolia.id,
  });

  const { data: borrowRate } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "getBorrowRate",
    chainId: baseSepolia.id,
  });

  // Calculate display values
  const tvl = totalDeposits ? Number(formatUnits(totalDeposits, 6)) : 0;
  const borrowed = totalBorrows ? Number(formatUnits(totalBorrows, 6)) : 0;
  const utilization = tvl > 0 ? (borrowed / tvl) * 100 : 0;
  
  // Rates are in basis points (1/10000), annualized
  const supplyAPY = supplyRate ? (Number(supplyRate) / 100).toFixed(1) : "0";
  const borrowAPR = borrowRate ? (Number(borrowRate) / 100).toFixed(1) : "0";

  // Format display
  const formatTvl = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Markets</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Lending pools for AI agents
        </p>
      </div>

      {/* Pool Card */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💵</span>
            <div>
              <h2 className="font-bold">USDC</h2>
              <p className="text-xs text-[var(--muted-foreground)]">Stablecoin</p>
            </div>
          </div>
          <span className="text-xs px-2 py-1 rounded bg-[var(--success)]/20 text-[var(--success)]">
            Low Risk
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border-b border-[var(--card-border)]">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">TVL</p>
            <p className="text-lg font-bold">{formatTvl(tvl)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Borrowed</p>
            <p className="text-lg font-bold">{formatTvl(borrowed)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Supply APY</p>
            <p className="text-lg font-bold text-[var(--success)]">{supplyAPY}%</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Borrow APR</p>
            <p className="text-lg font-bold">{borrowAPR}%</p>
          </div>
        </div>

        {/* Utilization */}
        <div className="p-4 border-b border-[var(--card-border)]">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--muted-foreground)]">Utilization</span>
            <span>{utilization.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)]"
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            🧪 Base Sepolia testnet
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 flex gap-3">
          <Link href="/lend" className="flex-1">
            <Button className="w-full">Supply</Button>
          </Link>
          <Link href="/agent" className="flex-1">
            <Button variant="outline" className="w-full">Borrow (Agent)</Button>
          </Link>
        </div>
      </div>

      {/* Chains */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          Currently live on{" "}
          <span className="inline-flex items-center gap-1">🧪 Base Sepolia</span>
        </p>
      </div>
    </div>
  );
}
