"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatUnits, parseAbiItem } from "viem";
import { base } from "viem/chains";
import { getLendingPoolAddress } from "@/config/wagmi";

const POOL_ADDRESS = getLendingPoolAddress(8453, "USDC");

type ActivityEvent = {
  type: "deposit" | "withdraw" | "borrow" | "repay";
  address: string;
  amount: string;
  txHash: string;
  timestamp: number;
  botId?: string;
};

const EVENT_ABIS = {
  Deposited: parseAbiItem("event Deposited(address indexed lender, uint256 amount, uint256 shares)"),
  Withdrawn: parseAbiItem("event Withdrawn(address indexed lender, uint256 amount, uint256 shares)"),
  Borrowed: parseAbiItem("event Borrowed(uint256 indexed botId, address indexed operator, uint256 amount)"),
  Repaid: parseAbiItem("event Repaid(uint256 indexed botId, uint256 principal, uint256 interest)"),
};

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(timestamp: number) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function ActivityFeed({ 
  filter = "all",
  limit = 10,
}: { 
  filter?: "all" | "supply" | "borrow";
  limit?: number;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      if (!POOL_ADDRESS) return;

      const client = createPublicClient({
        chain: base,
        transport: http("https://mainnet.base.org"),
      });

      try {
        // Get current block
        const currentBlock = await client.getBlockNumber();
        const fromBlock = currentBlock - 50000n; // ~1 day of blocks

        const allEvents: ActivityEvent[] = [];

        // Fetch deposit events
        if (filter === "all" || filter === "supply") {
          const depositLogs = await client.getLogs({
            address: POOL_ADDRESS,
            event: EVENT_ABIS.Deposited,
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of depositLogs) {
            const block = await client.getBlock({ blockNumber: log.blockNumber });
            allEvents.push({
              type: "deposit",
              address: log.args.lender || "",
              amount: formatUnits(log.args.amount || 0n, 6),
              txHash: log.transactionHash,
              timestamp: Number(block.timestamp),
            });
          }

          const withdrawLogs = await client.getLogs({
            address: POOL_ADDRESS,
            event: EVENT_ABIS.Withdrawn,
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of withdrawLogs) {
            const block = await client.getBlock({ blockNumber: log.blockNumber });
            allEvents.push({
              type: "withdraw",
              address: log.args.lender || "",
              amount: formatUnits(log.args.amount || 0n, 6),
              txHash: log.transactionHash,
              timestamp: Number(block.timestamp),
            });
          }
        }

        // Fetch borrow/repay events
        if (filter === "all" || filter === "borrow") {
          const borrowLogs = await client.getLogs({
            address: POOL_ADDRESS,
            event: EVENT_ABIS.Borrowed,
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of borrowLogs) {
            const block = await client.getBlock({ blockNumber: log.blockNumber });
            allEvents.push({
              type: "borrow",
              address: log.args.operator || "",
              amount: formatUnits(log.args.amount || 0n, 6),
              txHash: log.transactionHash,
              timestamp: Number(block.timestamp),
              botId: log.args.botId?.toString(),
            });
          }

          const repayLogs = await client.getLogs({
            address: POOL_ADDRESS,
            event: EVENT_ABIS.Repaid,
            fromBlock,
            toBlock: currentBlock,
          });

          for (const log of repayLogs) {
            const block = await client.getBlock({ blockNumber: log.blockNumber });
            const principal = log.args.principal || 0n;
            const interest = log.args.interest || 0n;
            allEvents.push({
              type: "repay",
              address: "", // Repay doesn't have operator in event
              amount: formatUnits(principal + interest, 6),
              txHash: log.transactionHash,
              timestamp: Number(block.timestamp),
              botId: log.args.botId?.toString(),
            });
          }
        }

        // Sort by timestamp descending
        allEvents.sort((a, b) => b.timestamp - a.timestamp);
        setEvents(allEvents.slice(0, limit));
      } catch (error) {
        console.error("Error fetching events:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, [filter, limit]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "deposit": return "📥";
      case "withdraw": return "📤";
      case "borrow": return "🤖";
      case "repay": return "✅";
      default: return "•";
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case "deposit": return "text-green-400";
      case "withdraw": return "text-yellow-400";
      case "borrow": return "text-blue-400";
      case "repay": return "text-emerald-400";
      default: return "";
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case "deposit": return "Supplied";
      case "withdraw": return "Withdrew";
      case "borrow": return "Borrowed";
      case "repay": return "Repaid";
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-6 text-sm text-[var(--muted-foreground)]">
        Loading activity...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-[var(--muted-foreground)]">
        No recent activity
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <a
          key={`${event.txHash}-${i}`}
          href={`https://basescan.org/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between py-2 px-3 rounded hover:bg-[var(--muted)]/30 transition-colors text-sm group"
        >
          <div className="flex items-center gap-3">
            <span className="text-base">{getEventIcon(event.type)}</span>
            <div>
              <span className={`font-medium ${getEventColor(event.type)}`}>
                {getEventLabel(event.type)}
              </span>
              <span className="text-[var(--muted-foreground)] ml-2">
                ${Number(event.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              {event.botId && (
                <span className="text-[var(--muted-foreground)] text-xs ml-2">
                  Bot #{event.botId}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
            {event.address && (
              <span className="hidden sm:inline">{shortenAddress(event.address)}</span>
            )}
            <span>{timeAgo(event.timestamp)}</span>
            <span className="opacity-0 group-hover:opacity-100">↗</span>
          </div>
        </a>
      ))}
    </div>
  );
}
