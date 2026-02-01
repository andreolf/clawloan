"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { base, arbitrum, optimism } from "viem/chains";
import { getLendingPoolAddress } from "@/config/wagmi";
import { LENDING_POOL_ABI } from "@/lib/contracts";

const CHAINS = [
  { id: 8453, chain: base, rpc: "https://mainnet.base.org" },
  { id: 42161, chain: arbitrum, rpc: "https://arb1.arbitrum.io/rpc" },
  { id: 10, chain: optimism, rpc: "https://mainnet.optimism.io" },
];

export function HomeStats() {
  const [tvl, setTvl] = useState(0);
  const [borrowed, setBorrowed] = useState(0);

  useEffect(() => {
    async function fetchAllChains() {
      let totalTvl = 0;
      let totalBorrowed = 0;

      await Promise.all(
        CHAINS.map(async (chainConfig) => {
          const poolAddress = getLendingPoolAddress(chainConfig.id, "USDC");
          if (!poolAddress) return;

          const client = createPublicClient({
            chain: chainConfig.chain,
            transport: http(chainConfig.rpc),
          });

          try {
            const deposits = await client.readContract({
              address: poolAddress,
              abi: LENDING_POOL_ABI,
              functionName: "totalDeposits",
            });
            const borrows = await client.readContract({
              address: poolAddress,
              abi: LENDING_POOL_ABI,
              functionName: "totalBorrows",
            });
            totalTvl += Number(formatUnits(deposits as bigint, 6));
            totalBorrowed += Number(formatUnits(borrows as bigint, 6));
          } catch (err) {
            console.error(`Error fetching from chain ${chainConfig.id}:`, err);
          }
        })
      );

      setTvl(totalTvl);
      setBorrowed(totalBorrowed);
    }

    fetchAllChains();
  }, []);

  const formatValue = (val: number) => {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
    if (val > 0) return `$${val.toFixed(0)}`;
    return "$0";
  };

  const utilization = tvl > 0 ? ((borrowed / tvl) * 100).toFixed(1) : "0";

  const stats = [
    { label: "total value locked", value: formatValue(tvl), href: "/lend" },
    { label: "borrowed", value: formatValue(borrowed), href: "/markets" },
    { label: "utilization", value: `${utilization}%`, href: "/markets" },
    { label: "chains", value: "3", href: "/markets" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
      {stats.map((stat) => (
        <Link key={stat.label} href={stat.href} className="group cursor-pointer">
          <p className="text-2xl font-bold text-[var(--primary)] group-hover:underline">
            {stat.value}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">{stat.label}</p>
        </Link>
      ))}
    </div>
  );
}
