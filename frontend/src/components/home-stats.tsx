"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { base } from "wagmi/chains";
import { getLendingPoolAddress } from "@/config/wagmi";
import { LENDING_POOL_ABI } from "@/lib/contracts";

const POOL_ADDRESS = getLendingPoolAddress(8453, "USDC");
const BASESCAN_URL = `https://basescan.org/address/${POOL_ADDRESS}`;

export function HomeStats() {
  const { data: totalDeposits } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "totalDeposits",
    chainId: base.id,
  });

  const { data: totalBorrows } = useReadContract({
    address: POOL_ADDRESS,
    abi: LENDING_POOL_ABI,
    functionName: "totalBorrows",
    chainId: base.id,
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
    { label: "total value locked", value: formatValue(tvl), href: "/lend" },
    { label: "borrowed", value: formatValue(borrowed), href: "/markets" },
    { label: "active loans", value: borrowed > 0 ? "1+" : "0", href: "/markets" },
    { label: "network", value: "Base", href: BASESCAN_URL, external: true },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
      {stats.map((stat) =>
        stat.external ? (
          <a
            key={stat.label}
            href={stat.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group cursor-pointer"
          >
            <p className="text-2xl font-bold text-[var(--primary)] group-hover:underline">
              {stat.value}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">{stat.label}</p>
          </a>
        ) : (
          <Link key={stat.label} href={stat.href} className="group cursor-pointer">
            <p className="text-2xl font-bold text-[var(--primary)] group-hover:underline">
              {stat.value}
            </p>
            <p className="text-xs text-[var(--muted-foreground)]">{stat.label}</p>
          </Link>
        )
      )}
    </div>
  );
}
