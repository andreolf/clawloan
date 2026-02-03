"use client";

import React, { useEffect, useState } from "react";

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
    async function fetchActivity() {
      try {
        const response = await fetch(`/api/activity?filter=${filter}`);
        const data = await response.json();
        
        if (data.events) {
          setEvents(data.events);
        } else {
          setError(data.error || "Failed to load");
        }
      } catch (err) {
        console.error("Error fetching activity:", err);
        setError("Failed to load");
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
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
