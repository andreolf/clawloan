"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { base } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/activity-feed";
import { getLendingPoolAddress } from "@/config/wagmi";
import { LENDING_POOL_ABI } from "@/lib/contracts";

// Default pool for stats display (Base Mainnet USDC - live)
const DEFAULT_CHAIN_ID = 8453;
const POOL_ADDRESS = getLendingPoolAddress(DEFAULT_CHAIN_ID, "USDC");

// Token info for display
const TOKENS = [
  { symbol: "USDC", name: "USD Coin", icon: "💵", risk: "Low", decimals: 6, live: true },
  { symbol: "USDT", name: "Tether", icon: "💲", risk: "Low", decimals: 6, live: false },
  { symbol: "DAI", name: "Dai", icon: "🟡", risk: "Low", decimals: 18, live: false },
  { symbol: "WETH", name: "Wrapped ETH", icon: "⟠", risk: "Medium", decimals: 18, live: false },
];

// Chains info
const CHAINS = [
  { name: "Base", icon: "🔵", live: true, testnet: "Base Sepolia" },
  { name: "Arbitrum", icon: "🔷", live: false, testnet: "Arbitrum Sepolia" },
  { name: "Optimism", icon: "🔴", live: false, testnet: "Optimism Sepolia" },
  { name: "Linea", icon: "🟢", live: false, testnet: "Linea Sepolia" },
  { name: "Solana", icon: "🟣", live: false, testnet: "Devnet", coming: true },
];

export default function MarketsPage() {
  // Read pool stats from Base Mainnet (live pool)
  const { data: totalDeposits } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "totalDeposits",
    chainId: base.id,
    query: { enabled: !!POOL_ADDRESS },
  });

  const { data: totalBorrows } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "totalBorrows",
    chainId: base.id,
    query: { enabled: !!POOL_ADDRESS },
  });

  const { data: supplyRate } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "getSupplyRate",
    chainId: base.id,
    query: { enabled: !!POOL_ADDRESS },
  });

  const { data: borrowRate } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "getBorrowRate",
    chainId: base.id,
    query: { enabled: !!POOL_ADDRESS },
  });

  // Calculate display values
  const tvl = totalDeposits ? Number(formatUnits(totalDeposits, 6)) : 0;
  const borrowed = totalBorrows ? Number(formatUnits(totalBorrows, 6)) : 0;
  const utilization = tvl > 0 ? (borrowed / tvl) * 100 : 0;
  
  // Rates are in RAY (1e27) precision, annualized
  const RAY = 1e27;
  const supplyAPY = supplyRate ? ((Number(supplyRate) / RAY) * 100).toFixed(1) : "0";
  const borrowAPR = borrowRate ? ((Number(borrowRate) / RAY) * 100).toFixed(1) : "0";

  // Format display
  const formatTvl = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold mb-2">Markets</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Lending pools for AI agents across chains
        </p>
      </div>

      {/* Live Pool - USDC on Base */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)] mb-3">Live Pools</h2>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💵</span>
              <div>
                <h2 className="font-bold">USDC</h2>
                <p className="text-xs text-[var(--muted-foreground)]">Base Mainnet</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-[var(--success)]/20 text-[var(--success)]">
                Low Risk
              </span>
              <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">
                🟢 Live
              </span>
            </div>
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
      </div>

      {/* Activity Feed */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)] mb-3">Recent Activity</h2>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4">
          <ActivityFeed filter="all" initialLimit={10} />
        </div>
      </div>

      {/* Coming Soon Tokens */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-[var(--muted-foreground)] mb-3">Coming Soon</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {TOKENS.filter(t => !t.live).map(token => (
            <div key={token.symbol} className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 opacity-60">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{token.icon}</span>
                <span className="font-medium">{token.symbol}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]">
                  {token.risk} Risk
                </span>
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">{token.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Supported Chains */}
      <div>
        <h2 className="text-sm font-medium text-[var(--muted-foreground)] mb-3">Supported Chains</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {CHAINS.map(chain => (
            <div 
              key={chain.name} 
              className={`bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-3 text-center ${!chain.live && 'opacity-60'}`}
            >
              <span className="text-2xl">{chain.icon}</span>
              <p className="text-sm font-medium mt-1">{chain.name}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {chain.live ? '🟢 Live' : chain.coming ? '🔮 Q2 2026' : '⏳ Soon'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
