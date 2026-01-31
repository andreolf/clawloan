import Link from "next/link";
import { Button } from "@/components/ui/button";

// Mock pool data
const pool = {
  asset: "USDC",
  tvl: "$1.2M",
  borrowed: "$890K",
  utilization: 74,
  supplyAPY: "12.4%",
  borrowAPR: "8.5%",
  activeBots: 47,
};

export default function MarketsPage() {
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
            <p className="text-lg font-bold">{pool.tvl}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Borrowed</p>
            <p className="text-lg font-bold">{pool.borrowed}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Supply APY</p>
            <p className="text-lg font-bold text-[var(--success)]">{pool.supplyAPY}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Borrow APR</p>
            <p className="text-lg font-bold">{pool.borrowAPR}</p>
          </div>
        </div>

        {/* Utilization */}
        <div className="p-4 border-b border-[var(--card-border)]">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-[var(--muted-foreground)]">Utilization</span>
            <span>{pool.utilization}%</span>
          </div>
          <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary)]"
              style={{ width: `${pool.utilization}%` }}
            />
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-2">
            {pool.activeBots} active agent loans
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
          Available on{" "}
          <span className="inline-flex items-center gap-1">🔵 Base</span>
          {" · "}
          <span className="inline-flex items-center gap-1">🟢 Linea</span>
        </p>
      </div>
    </div>
  );
}
