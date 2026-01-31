"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Stats {
  protocol: {
    tvl: string;
    totalBorrows: string;
    utilization: number;
    supplyAPY: string;
    borrowAPR: string;
  };
  bots: {
    total: number;
    active: number;
    newLast7Days: number;
  };
  loans: {
    total: number;
    active: number;
    repaid: number;
    defaulted: number;
    newLast7Days: number;
    totalVolumeUSDC: string;
  };
  deposits: {
    count: number;
    totalVolumeUSDC: string;
  };
  timestamp: string;
}

interface Loan {
  id: string;
  botId: string;
  principal: string;
  status: string;
  createdAt: string;
  bot: {
    name: string;
    operatorAddress: string;
  };
  totalOwed: string;
}

interface Bot {
  id: string;
  name: string;
  operatorAddress: string;
  active: boolean;
  createdAt: string;
  loans: { status: string }[];
}

interface HealthStatus {
  status: string;
  latency: string;
  database: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      const [statsRes, loansRes, botsRes, healthRes] = await Promise.all([
        fetch("/api/stats").catch(() => null),
        fetch("/api/loans").catch(() => null),
        fetch("/api/bots").catch(() => null),
        fetch("/api/health").catch(() => null),
      ]);

      if (statsRes?.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      if (loansRes?.ok) {
        const loansData = await loansRes.json();
        setLoans(loansData.loans || []);
      }
      if (botsRes?.ok) {
        const botsData = await botsRes.json();
        setBots(botsData.bots || []);
      }
      if (healthRes?.ok) {
        const healthData = await healthRes.json();
        setHealth(healthData);
      } else {
        setHealth({ status: "unhealthy", latency: "N/A", database: "error" });
      }
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const formatUSDC = (value: string) => {
    const num = Number(value) / 1e6;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const formatAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--card)] rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-[var(--card)] rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${health?.status === "healthy" ? "bg-green-500" : "bg-red-500"
                }`}
            />
            <span className="text-sm">
              {health?.status === "healthy" ? "Healthy" : "Unhealthy"}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              ({health?.latency})
            </span>
          </div>
          <Button size="sm" onClick={fetchData}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">TVL</p>
          <p className="text-2xl font-bold text-[var(--primary)]">
            {stats ? formatUSDC(stats.protocol.tvl) : "$0"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">
            Total Borrowed
          </p>
          <p className="text-2xl font-bold">
            {stats ? formatUSDC(stats.protocol.totalBorrows) : "$0"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">
            Utilization
          </p>
          <p className="text-2xl font-bold">
            {stats ? `${stats.protocol.utilization.toFixed(1)}%` : "0%"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">
            Active Loans
          </p>
          <p className="text-2xl font-bold">{stats?.loans.active || 0}</p>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
        <Card className="p-3">
          <p className="text-xs text-[var(--muted-foreground)]">Total Bots</p>
          <p className="text-lg font-bold">{stats?.bots.total || 0}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-[var(--muted-foreground)]">Active Bots</p>
          <p className="text-lg font-bold">{stats?.bots.active || 0}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-[var(--muted-foreground)]">Total Loans</p>
          <p className="text-lg font-bold">{stats?.loans.total || 0}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-[var(--muted-foreground)]">Repaid</p>
          <p className="text-lg font-bold text-green-500">
            {stats?.loans.repaid || 0}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-[var(--muted-foreground)]">Defaulted</p>
          <p className="text-lg font-bold text-red-500">
            {stats?.loans.defaulted || 0}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-[var(--muted-foreground)]">New (7d)</p>
          <p className="text-lg font-bold">{stats?.loans.newLast7Days || 0}</p>
        </Card>
      </div>

      {/* Rates */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">
            Supply APY
          </p>
          <p className="text-xl font-bold text-green-500">
            {stats?.protocol.supplyAPY || "0%"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-1">
            Borrow APR
          </p>
          <p className="text-xl font-bold text-orange-500">
            {stats?.protocol.borrowAPR || "0%"}
          </p>
        </Card>
      </div>

      {/* Active Loans Table */}
      <Card className="p-4 mb-8">
        <h2 className="font-bold mb-4">Active Loans</h2>
        {loans.filter((l) => l.status === "ACTIVE").length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No active loans
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="text-left py-2">Bot</th>
                  <th className="text-left py-2">Operator</th>
                  <th className="text-right py-2">Principal</th>
                  <th className="text-right py-2">Owed</th>
                  <th className="text-left py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {loans
                  .filter((l) => l.status === "ACTIVE")
                  .map((loan) => (
                    <tr
                      key={loan.id}
                      className="border-b border-[var(--card-border)]"
                    >
                      <td className="py-2">{loan.bot?.name || loan.botId}</td>
                      <td className="py-2 font-mono text-xs">
                        {formatAddress(loan.bot?.operatorAddress || "0x")}
                      </td>
                      <td className="py-2 text-right">
                        {formatUSDC(loan.principal)}
                      </td>
                      <td className="py-2 text-right font-bold">
                        {formatUSDC(loan.totalOwed)}
                      </td>
                      <td className="py-2 text-[var(--muted-foreground)]">
                        {new Date(loan.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent Bots Table */}
      <Card className="p-4">
        <h2 className="font-bold mb-4">Recent Bots</h2>
        {bots.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">
            No bots registered
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--card-border)]">
                  <th className="text-left py-2">Name</th>
                  <th className="text-left py-2">Operator</th>
                  <th className="text-center py-2">Status</th>
                  <th className="text-center py-2">Active Loans</th>
                  <th className="text-left py-2">Registered</th>
                </tr>
              </thead>
              <tbody>
                {bots.slice(0, 10).map((bot) => (
                  <tr
                    key={bot.id}
                    className="border-b border-[var(--card-border)]"
                  >
                    <td className="py-2">{bot.name}</td>
                    <td className="py-2 font-mono text-xs">
                      {formatAddress(bot.operatorAddress)}
                    </td>
                    <td className="py-2 text-center">
                      <span
                        className={`px-2 py-1 rounded text-xs ${bot.active
                            ? "bg-green-500/20 text-green-500"
                            : "bg-red-500/20 text-red-500"
                          }`}
                      >
                        {bot.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      {bot.loans?.filter((l) => l.status === "ACTIVE").length ||
                        0}
                    </td>
                    <td className="py-2 text-[var(--muted-foreground)]">
                      {new Date(bot.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-[var(--muted-foreground)]">
        <p>Clawloan Admin Dashboard v1.0</p>
        <p>Data refreshes every 30 seconds</p>
        <p className="mt-1 text-yellow-500/70">
          ⚠️ Shows database stats. On-chain deposits visible on /lend page.
        </p>
      </div>
    </div>
  );
}
