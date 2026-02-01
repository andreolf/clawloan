"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { base, arbitrum, optimism } from "viem/chains";
import { useChainId } from "wagmi";
import { getLendingPoolAddress } from "@/config/wagmi";

const CHAIN_CONFIG = {
  8453: { chain: base, rpc: "https://mainnet.base.org", explorer: "https://basescan.org", blockTime: 2 },
  42161: { chain: arbitrum, rpc: "https://arb1.arbitrum.io/rpc", explorer: "https://arbiscan.io", blockTime: 0.25 },
  10: { chain: optimism, rpc: "https://mainnet.optimism.io", explorer: "https://optimistic.etherscan.io", blockTime: 2 },
};

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

function blocksAgo(currentBlock: bigint, eventBlock: bigint, blockTime: number = 2) {
  const diff = Number(currentBlock - eventBlock);
  const seconds = diff * blockTime;
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
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
  const chainId = useChainId();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState("https://basescan.org");
  const [blockTime, setBlockTime] = useState(2);

  useEffect(() => {
    async function fetchEvents() {
      const config = CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG];
      if (!config) {
        setLoading(false);
        setError("Chain not supported");
        return;
      }

      const poolAddress = getLendingPoolAddress(chainId, "USDC");
      if (!poolAddress) {
        setLoading(false);
        setError("No pool on this chain");
        return;
      }

      setExplorerUrl(config.explorer);
      setBlockTime(config.blockTime);

      const client = createPublicClient({
        chain: config.chain,
        transport: http(config.rpc),
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
          address: poolAddress,
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
  }, [filter, limit, chainId]);

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
    const config = CHAIN_CONFIG[chainId as keyof typeof CHAIN_CONFIG];
    if (!config) return;
    const client = createPublicClient({
      chain: config.chain,
      transport: http(config.rpc),
    });
    client.getBlockNumber().then(setCurrentBlock).catch(() => {});
  }, [chainId]);

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
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {events.map((event, i) => (
        <a
          key={`${event.txHash}-${i}`}
          href={`${explorerUrl}/tx/${event.txHash}`}
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
            <span>{currentBlock > 0n ? blocksAgo(currentBlock, event.blockNumber, blockTime) : ""}</span>
            <span className="opacity-0 group-hover:opacity-100">↗</span>
          </div>
        </a>
      ))}
    </div>
  );
}
