"use client";

import React, { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { getLendingPoolAddress } from "@/config/wagmi";

const CHAINS = [
  { 
    id: 8453, 
    explorer: "https://basescan.org", 
    api: "https://api.basescan.org/api",
    name: "Base", 
    icon: "🔵",
  },
  { 
    id: 42161, 
    explorer: "https://arbiscan.io", 
    api: "https://api.arbiscan.io/api",
    name: "Arbitrum", 
    icon: "🔷",
  },
  { 
    id: 10, 
    explorer: "https://optimistic.etherscan.io", 
    api: "https://api-optimistic.etherscan.io/api",
    name: "Optimism", 
    icon: "🔴",
  },
];

type ActivityEvent = {
  type: "deposit" | "withdraw" | "borrow" | "repay";
  address: string;
  amount: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
  botId?: string;
  chainId: number;
  chainName: string;
  chainIcon: string;
  explorer: string;
  isAgent: boolean;
};

// Event signatures (topic0)
const EVENT_TOPICS = {
  Deposited: "0x73a19dd210f1a7f902193214c0ee91dd35ee5b4d920cba8d519eca65a7b488ca",
  Withdrawn: "0x92ccf450a286a957af52509bc1c9939d1a6a481783e142e41e2499f0bb66ebc6",
  Borrowed: "0x68045833607620b046673ad9d71b3f95e5626241b0d4d66477a2c600ad85b716",
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
  if (!topic || topic.length < 42) return "";
  return "0x" + topic.slice(26);
}

function decodeAmount(data: string, offset: number = 0): bigint {
  const start = 2 + offset * 64;
  const hex = data.slice(start, start + 64);
  if (!hex) return 0n;
  return BigInt("0x" + hex);
}

export function ActivityFeed({ 
  filter = "all",
  maxHeight = 400,
}: { 
  filter?: "all" | "supply" | "borrow";
  maxHeight?: number;
}) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      setCanScrollDown(scrollTop + clientHeight < scrollHeight - 10);
    }
  };

  useEffect(() => {
    setTimeout(checkScroll, 100);
  }, [events]);

  useEffect(() => {
    async function fetchAllChains() {
      const fetchedEvents: ActivityEvent[] = [];
      
      const promises = CHAINS.map(async (chainConfig) => {
        const poolAddress = getLendingPoolAddress(chainConfig.id, "USDC");
        if (!poolAddress) return [];

        try {
          // Use block explorer API for reliable log fetching
          const url = `${chainConfig.api}?module=logs&action=getLogs&address=${poolAddress}&fromBlock=0&toBlock=latest&page=1&offset=100`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status !== "1" || !Array.isArray(data.result)) {
            console.log(`No logs from ${chainConfig.name}:`, data.message);
            return [];
          }

          const chainEvents: ActivityEvent[] = [];

          for (const log of data.result) {
            const topic0 = log.topics?.[0];
            const timestamp = parseInt(log.timeStamp, 16);
            
            if (topic0 === EVENT_TOPICS.Deposited && (filter === "all" || filter === "supply")) {
              chainEvents.push({
                type: "deposit",
                address: log.topics?.[1] ? decodeAddress(log.topics[1]) : "",
                amount: formatUnits(decodeAmount(log.data, 0), 6),
                txHash: log.transactionHash,
                blockNumber: parseInt(log.blockNumber, 16),
                timestamp,
                chainId: chainConfig.id,
                chainName: chainConfig.name,
                chainIcon: chainConfig.icon,
                explorer: chainConfig.explorer,
                isAgent: false,
              });
            } else if (topic0 === EVENT_TOPICS.Withdrawn && (filter === "all" || filter === "supply")) {
              chainEvents.push({
                type: "withdraw",
                address: log.topics?.[1] ? decodeAddress(log.topics[1]) : "",
                amount: formatUnits(decodeAmount(log.data, 0), 6),
                txHash: log.transactionHash,
                blockNumber: parseInt(log.blockNumber, 16),
                timestamp,
                chainId: chainConfig.id,
                chainName: chainConfig.name,
                chainIcon: chainConfig.icon,
                explorer: chainConfig.explorer,
                isAgent: false,
              });
            } else if (topic0 === EVENT_TOPICS.Borrowed && (filter === "all" || filter === "borrow")) {
              chainEvents.push({
                type: "borrow",
                address: log.topics?.[2] ? decodeAddress(log.topics[2]) : "",
                amount: formatUnits(decodeAmount(log.data, 0), 6),
                txHash: log.transactionHash,
                blockNumber: parseInt(log.blockNumber, 16),
                timestamp,
                botId: log.topics?.[1] ? Number(BigInt(log.topics[1])).toString() : undefined,
                chainId: chainConfig.id,
                chainName: chainConfig.name,
                chainIcon: chainConfig.icon,
                explorer: chainConfig.explorer,
                isAgent: true,
              });
            } else if (topic0 === EVENT_TOPICS.Repaid && (filter === "all" || filter === "borrow")) {
              const principal = decodeAmount(log.data, 0);
              const interest = decodeAmount(log.data, 1);
              chainEvents.push({
                type: "repay",
                address: "",
                amount: formatUnits(principal + interest, 6),
                txHash: log.transactionHash,
                blockNumber: parseInt(log.blockNumber, 16),
                timestamp,
                botId: log.topics?.[1] ? Number(BigInt(log.topics[1])).toString() : undefined,
                chainId: chainConfig.id,
                chainName: chainConfig.name,
                chainIcon: chainConfig.icon,
                explorer: chainConfig.explorer,
                isAgent: true,
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
        results.forEach(chainEvents => fetchedEvents.push(...chainEvents));
        
        // Sort by timestamp descending (most recent first)
        fetchedEvents.sort((a, b) => b.timestamp - a.timestamp);
        setEvents(fetchedEvents);
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchAllChains();
  }, [filter]);

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
    <div className="relative">
      <div 
        ref={scrollRef}
        onScroll={checkScroll}
        className="space-y-2 overflow-y-auto scrollbar-thin scrollbar-thumb-[var(--muted)] scrollbar-track-transparent"
        style={{ maxHeight: `${maxHeight}px` }}
      >
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
              <span 
                title={event.isAgent ? "Agent" : "Human"} 
                className={event.isAgent ? "text-blue-400" : "text-orange-400"}
              >
                {event.isAgent ? "🤖" : "👤"}
              </span>
              {event.address && (
                <span className="hidden sm:inline">{shortenAddress(event.address)}</span>
              )}
              <span>{timeAgo(event.timestamp)}</span>
              <span className="opacity-0 group-hover:opacity-100">↗</span>
            </div>
          </a>
        ))}
      </div>
      {canScrollDown && (
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--card)] to-transparent pointer-events-none flex items-end justify-center pb-1">
          <span className="text-xs text-[var(--muted-foreground)] animate-bounce">↓ scroll</span>
        </div>
      )}
      {events.length > 5 && (
        <div className="text-center pt-2 text-xs text-[var(--muted-foreground)]">
          {events.length} total events
        </div>
      )}
    </div>
  );
}
