"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, formatUnits } from "viem";
import { base, arbitrum, optimism } from "viem/chains";
import { getLendingPoolAddress } from "@/config/wagmi";

const CHAINS = [
  { id: 8453, chain: base, rpc: "https://mainnet.base.org", explorer: "https://basescan.org", name: "Base", icon: "🔵", blockTime: 2 },
  { id: 42161, chain: arbitrum, rpc: "https://arb1.arbitrum.io/rpc", explorer: "https://arbiscan.io", name: "Arbitrum", icon: "🔷", blockTime: 0.25 },
  { id: 10, chain: optimism, rpc: "https://mainnet.optimism.io", explorer: "https://optimistic.etherscan.io", name: "Optimism", icon: "🔴", blockTime: 2 },
];

type ActivityEvent = {
  type: "deposit" | "withdraw" | "borrow" | "repay";
  address: string;
  amount: string;
  txHash: string;
  blockNumber: bigint;
  timestamp: number; // Approximate timestamp
  botId?: string;
  chainId: number;
  chainName: string;
  chainIcon: string;
  explorer: string;
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

function timeAgo(timestamp: number) {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
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
    async function fetchAllChains() {
      const allEvents: ActivityEvent[] = [];
      
      // Fetch from all chains in parallel
      const promises = CHAINS.map(async (chainConfig) => {
        const poolAddress = getLendingPoolAddress(chainConfig.id, "USDC");
        if (!poolAddress) return [];

        const client = createPublicClient({
          chain: chainConfig.chain,
          transport: http(chainConfig.rpc),
        });

        try {
          const currentBlock = await client.getBlockNumber();
          // Adjust lookback based on block time
          const blocksToLookback = chainConfig.id === 42161 ? 100000n : 10000n;
          const fromBlock = currentBlock - blocksToLookback;
          const now = Math.floor(Date.now() / 1000);

          const logs = await client.getLogs({
            address: poolAddress,
            fromBlock,
            toBlock: currentBlock,
          });

          const chainEvents: ActivityEvent[] = [];

          for (const log of logs) {
            const topic0 = log.topics[0];
            // Estimate timestamp based on block difference
            const blockDiff = Number(currentBlock - log.blockNumber);
            const estimatedTimestamp = now - Math.floor(blockDiff * chainConfig.blockTime);
            
            if (topic0 === EVENT_TOPICS.Deposited && (filter === "all" || filter === "supply")) {
              chainEvents.push({
                type: "deposit",
                address: log.topics[1] ? decodeAddress(log.topics[1]) : "",
                amount: formatUnits(decodeAmount(log.data, 0), 6),
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
                timestamp: estimatedTimestamp,
                chainId: chainConfig.id,
                chainName: chainConfig.name,
                chainIcon: chainConfig.icon,
                explorer: chainConfig.explorer,
              });
            } else if (topic0 === EVENT_TOPICS.Withdrawn && (filter === "all" || filter === "supply")) {
              chainEvents.push({
                type: "withdraw",
                address: log.topics[1] ? decodeAddress(log.topics[1]) : "",
                amount: formatUnits(decodeAmount(log.data, 0), 6),
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
                timestamp: estimatedTimestamp,
                chainId: chainConfig.id,
                chainName: chainConfig.name,
                chainIcon: chainConfig.icon,
                explorer: chainConfig.explorer,
              });
            } else if (topic0 === EVENT_TOPICS.Borrowed && (filter === "all" || filter === "borrow")) {
              chainEvents.push({
                type: "borrow",
                address: log.topics[2] ? decodeAddress(log.topics[2]) : "",
                amount: formatUnits(decodeAmount(log.data, 0), 6),
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
                timestamp: estimatedTimestamp,
                botId: log.topics[1] ? Number(BigInt(log.topics[1])).toString() : undefined,
                chainId: chainConfig.id,
                chainName: chainConfig.name,
                chainIcon: chainConfig.icon,
                explorer: chainConfig.explorer,
              });
            } else if (topic0 === EVENT_TOPICS.Repaid && (filter === "all" || filter === "borrow")) {
              const principal = decodeAmount(log.data, 0);
              const interest = decodeAmount(log.data, 1);
              chainEvents.push({
                type: "repay",
                address: "",
                amount: formatUnits(principal + interest, 6),
                txHash: log.transactionHash,
                blockNumber: log.blockNumber,
                timestamp: estimatedTimestamp,
                botId: log.topics[1] ? Number(BigInt(log.topics[1])).toString() : undefined,
                chainId: chainConfig.id,
                chainName: chainConfig.name,
                chainIcon: chainConfig.icon,
                explorer: chainConfig.explorer,
              });
            }
          }

          return chainEvents;
        } catch (err) {
          console.error(`Error fetching from ${chainConfig.name}:`, err);
          return [];
        }
      });

      try {
        const results = await Promise.all(promises);
        results.forEach(chainEvents => allEvents.push(...chainEvents));
        
        // Sort by timestamp descending (most recent first)
        allEvents.sort((a, b) => b.timestamp - a.timestamp);
        setEvents(allEvents.slice(0, limit));
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchAllChains();
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
        Loading activity from all chains...
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
        No recent activity across any chain
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {events.map((event, i) => (
        <a
          key={`${event.txHash}-${i}`}
          href={`${event.explorer}/tx/${event.txHash}`}
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
          <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <span title={event.chainName}>{event.chainIcon}</span>
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
