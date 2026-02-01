"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { base } from "viem/chains";
import { getLendingPoolAddress } from "@/config/wagmi";

const POOL_ADDRESS = getLendingPoolAddress(8453, "USDC");

type ActivityEvent = {
  type: "deposit" | "withdraw" | "borrow" | "repay";
  address: string;
  amount: string;
  txHash: string;
  blockNumber: bigint;
  botId?: string;
};

// Event signatures (topic0)
const EVENT_TOPICS = {
  Deposited: "0x73a19dd210f1a7f902193214c0ee91dd35ee5b4d920cba8d519eca65a7b488ca",
  Withdrawn: "0x92ccf450a286a957af52509bc1c9939d1a6a481783e142e41e2499f0bb66ebc6",
  Borrowed: "0xeaf3bd02ad76e4b07064f7a219cd7722f0124fcc8b391721b63bc069aa4cbeb8",
  Repaid: "0x06a603347cb6691efaab973c3ff98f9a16a157e92d51c4783645418d8537912e",
};

function shortenAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function blocksAgo(currentBlock: bigint, eventBlock: bigint) {
  const diff = Number(currentBlock - eventBlock);
  const seconds = diff * 2; // ~2s per block on Base
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function decodeAddress(topic: string): string {
  return "0x" + topic.slice(26);
}

function decodeAmount(data: string, offset: number = 0): bigint {
  const start = 2 + offset * 64;
  const hex = data.slice(start, start + 64);
  return BigInt("0x" + hex);
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      if (!POOL_ADDRESS) {
        setLoading(false);
        return;
      }

      const client = createPublicClient({
        chain: base,
        transport: http("https://mainnet.base.org"),
      });

      try {
        const currentBlock = await client.getBlockNumber();
        const fromBlock = currentBlock - 10000n; // ~5 hours of blocks (less to avoid rate limits)

        const allEvents: ActivityEvent[] = [];

        // Build topics based on filter
        const topics: string[] = [];
        if (filter === "all") {
          topics.push(EVENT_TOPICS.Deposited, EVENT_TOPICS.Withdrawn, EVENT_TOPICS.Borrowed, EVENT_TOPICS.Repaid);
        } else if (filter === "supply") {
          topics.push(EVENT_TOPICS.Deposited, EVENT_TOPICS.Withdrawn);
        } else {
          topics.push(EVENT_TOPICS.Borrowed, EVENT_TOPICS.Repaid);
        }

        // Fetch all logs in one call
        const logs = await client.getLogs({
          address: POOL_ADDRESS,
          fromBlock,
          toBlock: currentBlock,
        });

        for (const log of logs) {
          const topic0 = log.topics[0];
          
          if (topic0 === EVENT_TOPICS.Deposited && (filter === "all" || filter === "supply")) {
            allEvents.push({
              type: "deposit",
              address: log.topics[1] ? decodeAddress(log.topics[1]) : "",
              amount: formatUnits(decodeAmount(log.data, 0), 6),
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            });
          } else if (topic0 === EVENT_TOPICS.Withdrawn && (filter === "all" || filter === "supply")) {
            allEvents.push({
              type: "withdraw",
              address: log.topics[1] ? decodeAddress(log.topics[1]) : "",
              amount: formatUnits(decodeAmount(log.data, 0), 6),
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
            });
          } else if (topic0 === EVENT_TOPICS.Borrowed && (filter === "all" || filter === "borrow")) {
            allEvents.push({
              type: "borrow",
              address: log.topics[2] ? decodeAddress(log.topics[2]) : "",
              amount: formatUnits(decodeAmount(log.data, 0), 6),
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              botId: log.topics[1] ? Number(BigInt(log.topics[1])).toString() : undefined,
            });
          } else if (topic0 === EVENT_TOPICS.Repaid && (filter === "all" || filter === "borrow")) {
            const principal = decodeAmount(log.data, 0);
            const interest = decodeAmount(log.data, 1);
            allEvents.push({
              type: "repay",
              address: "",
              amount: formatUnits(principal + interest, 6),
              txHash: log.transactionHash,
              blockNumber: log.blockNumber,
              botId: log.topics[1] ? Number(BigInt(log.topics[1])).toString() : undefined,
            });
          }
        }

        // Sort by block number descending
        allEvents.sort((a, b) => Number(b.blockNumber - a.blockNumber));
        setEvents(allEvents.slice(0, limit));
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load");
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

  // Get current block for time display
  const [currentBlock, setCurrentBlock] = useState<bigint>(0n);
  useEffect(() => {
    const client = createPublicClient({
      chain: base,
      transport: http("https://mainnet.base.org"),
    });
    client.getBlockNumber().then(setCurrentBlock).catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="text-center py-6 text-sm text-[var(--muted-foreground)]">
        Loading activity...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-sm text-[var(--muted-foreground)]">
        {error}
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
            <span>{currentBlock > 0n ? blocksAgo(currentBlock, event.blockNumber) : ""}</span>
            <span className="opacity-0 group-hover:opacity-100">↗</span>
          </div>
        </a>
      ))}
    </div>
  );
}
