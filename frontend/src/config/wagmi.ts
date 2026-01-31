import { http, createConfig } from "wagmi";
import { base, baseSepolia, foundry, linea, lineaSepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

// Contract addresses - update after deployment
export const CONTRACT_ADDRESSES = {
  // Local Anvil (foundry)
  31337: {
    usdc: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const,
    botRegistry: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const,
    permissionsRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as const,
    lendingPool: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as const,
    clawloanToken: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" as const,
    stakingModule: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707" as const,
  },
  // Base Sepolia
  84532: {
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const, // USDC on Base Sepolia
    botRegistry: "" as const,
    permissionsRegistry: "" as const,
    lendingPool: "" as const,
    clawloanToken: "" as const,
    stakingModule: "" as const,
  },
  // Base Mainnet
  8453: {
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const, // Native USDC on Base
    botRegistry: "" as const,
    permissionsRegistry: "" as const,
    lendingPool: "" as const,
    clawloanToken: "" as const,
    stakingModule: "" as const,
  },
  // Linea Mainnet
  59144: {
    usdc: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff" as const, // USDC.e on Linea
    botRegistry: "" as const,
    permissionsRegistry: "" as const,
    lendingPool: "" as const,
    clawloanToken: "" as const,
    stakingModule: "" as const,
  },
  // Linea Sepolia
  59141: {
    usdc: "" as const, // Testnet USDC TBD
    botRegistry: "" as const,
    permissionsRegistry: "" as const,
    lendingPool: "" as const,
    clawloanToken: "" as const,
    stakingModule: "" as const,
  },
} as const;

export const config = createConfig({
  chains: [foundry, baseSepolia, base, linea, lineaSepolia],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "demo",
    }),
  ],
  transports: {
    [foundry.id]: http("http://127.0.0.1:8545"),
    [baseSepolia.id]: http(),
    [base.id]: http(),
    [linea.id]: http(),
    [lineaSepolia.id]: http(),
  },
});

export function getContractAddress(
  chainId: number,
  contract: keyof (typeof CONTRACT_ADDRESSES)[31337]
): `0x${string}` | undefined {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!addresses) return undefined;
  const address = addresses[contract];
  if (!address || address.length < 10) return undefined;
  return address;
}

// Chain display info
export const SUPPORTED_CHAINS = [
  { id: 8453, name: "Base", icon: "🔵" },
  { id: 59144, name: "Linea", icon: "🟢" },
  { id: 84532, name: "Base Sepolia", icon: "🔵", testnet: true },
  { id: 59141, name: "Linea Sepolia", icon: "🟢", testnet: true },
  { id: 31337, name: "Local", icon: "🔧", testnet: true },
];
