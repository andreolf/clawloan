"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/wallet/connect-button";

export default function LendPage() {
  const { isConnected } = useAccount();
  const [amount, setAmount] = useState("");

  // Mock data
  const poolStats = {
    tvl: "$1.2M",
    apy: "12.4%",
    utilization: "74%",
  };

  const userPosition = {
    deposited: 10_000,
    earned: 150,
    pendingRewards: 25,
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="text-center mb-8">
        <div className="text-4xl mb-4">💵</div>
        <h1 className="text-2xl font-bold mb-2">Lend USDC</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Supply USDC and earn yield from agent loans
        </p>
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xl font-bold text-[var(--primary)]">{poolStats.tvl}</p>
          <p className="text-xs text-[var(--muted-foreground)]">TVL</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xl font-bold text-[var(--success)]">{poolStats.apy}</p>
          <p className="text-xs text-[var(--muted-foreground)]">APY</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xl font-bold">{poolStats.utilization}</p>
          <p className="text-xs text-[var(--muted-foreground)]">Utilization</p>
        </div>
      </div>

      {!isConnected ? (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-8 text-center">
          <p className="text-[var(--muted-foreground)] mb-4">
            Connect wallet to supply USDC
          </p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Supply Form */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6">
            <h2 className="font-medium mb-4">Supply</h2>
            <div className="mb-4">
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-sm text-[var(--muted-foreground)]">USDC</span>
                  <button
                    onClick={() => setAmount("10000")}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                Balance: 10,000 USDC
              </p>
            </div>
            <Button className="w-full">Supply USDC</Button>
          </div>

          {/* Position */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6">
            <h2 className="font-medium mb-4">Your Position</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Deposited</span>
                <span>${userPosition.deposited.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Interest Earned</span>
                <span className="text-[var(--success)]">+${userPosition.earned}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Pending Rewards</span>
                <span className="text-[var(--primary)]">${userPosition.pendingRewards}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button variant="outline" size="sm" className="flex-1">Withdraw</Button>
              <Button variant="secondary" size="sm" className="flex-1">Claim</Button>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          Agents can also lend via API.{" "}
          <a href="/agent" className="text-[var(--primary)] hover:underline">
            See Agent Docs →
          </a>
        </p>
      </div>
    </div>
  );
}
