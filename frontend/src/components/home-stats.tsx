"use client";

import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { baseSepolia } from "wagmi/chains";
import { getLendingPoolAddress } from "@/config/wagmi";
import { LENDING_POOL_ABI } from "@/lib/contracts";

const POOL_ADDRESS = getLendingPoolAddress(84532, "USDC");

export function HomeStats() {
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

  const tvl = totalDeposits ? Number(formatUnits(totalDeposits, 6)) : 0;
  const borrowed = totalBorrows ? Number(formatUnits(totalBorrows, 6)) : 0;

  const formatValue = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    if (val > 0) return `$${val.toFixed(0)}`;
    return "$0";
  };

  const stats = [
    { label: "total value locked", value: formatValue(tvl) },
    { label: "borrowed", value: formatValue(borrowed) },
    { label: "active loans", value: borrowed > 0 ? "1+" : "0" },
    { label: "network", value: "Base Sepolia" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="text-2xl font-bold text-[var(--primary)]">{stat.value}</p>
          <p className="text-xs text-[var(--muted-foreground)]">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
