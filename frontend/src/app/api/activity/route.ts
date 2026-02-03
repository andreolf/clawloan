import { NextResponse } from "next/server";
import { formatUnits } from "viem";

const CHAINS = [
  {
    id: 8453,
    explorer: "https://basescan.org",
    api: "https://base.blockscout.com/api",
    name: "Base",
    icon: "🔵",
    lendingPool: "0x3Dca46B18D3a49f36311fb7A9b444B6041241906",
  },
  {
    id: 42161,
    explorer: "https://arbiscan.io",
    api: "https://arbitrum.blockscout.com/api",
    name: "Arbitrum",
    icon: "🔷",
    lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09",
  },
  {
    id: 10,
    explorer: "https://optimistic.etherscan.io",
    api: "https://optimism.blockscout.com/api",
    name: "Optimism",
    icon: "🔴",
    lendingPool: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09",
  },
];

// Event signatures (topic0) - must match LendingPoolV2.sol
const EVENT_TOPICS = {
  // Deposited(address indexed lender, uint256 amount, uint256 shares)
  Deposited: "0x73a19dd210f1a7f902193214c0ee91dd35ee5b4d920cba8d519eca65a7b488ca",
  // Withdrawn(address indexed lender, uint256 amount, uint256 shares)
  Withdrawn: "0x92ccf450a286a957af52509bc1c9939d1a6a481783e142e41e2499f0bb66ebc6",
  // Borrowed(uint256 indexed botId, uint256 amount, address indexed operator, uint256 deadline)
  Borrowed: "0x6d663f6f3fa1b4b5453c6eb0b71b7198d77292351285d35c611aa1095f8c5524",
  // Repaid(uint256 indexed botId, uint256 principal, uint256 interest)
  Repaid: "0x06a603347cb6691efaab973c3ff98f9a16a157e92d51c4783645418d8537912e",
};

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "all";

  const fetchedEvents: ActivityEvent[] = [];

  // Fetch from all chains in parallel (server-side, no CORS issues)
  const promises = CHAINS.map(async (chainConfig) => {
    try {
      const url = `${chainConfig.api}?module=logs&action=getLogs&address=${chainConfig.lendingPool}&fromBlock=0&toBlock=latest`;

      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
        next: { revalidate: 30 }, // Cache for 30 seconds
      });

      const data = await response.json();

      if (data.status !== "1" && data.message !== "OK") {
        console.log(`No logs from ${chainConfig.name}:`, data.message);
        return [];
      }

      if (!Array.isArray(data.result)) {
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

    return NextResponse.json({ events: fetchedEvents });
  } catch (err) {
    console.error("Error fetching events:", err);
    return NextResponse.json({ error: "Failed to fetch activity", events: [] }, { status: 500 });
  }
}
