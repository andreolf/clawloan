import { http, createConfig } from "wagmi";
import { 
  base, 
  baseSepolia, 
  foundry, 
  linea, 
  lineaSepolia,
  arbitrum,
  arbitrumSepolia,
  optimism,
  optimismSepolia,
  mainnet,
} from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

// ============ Token Addresses by Chain ============
// Native token addresses for each supported chain
export const TOKEN_ADDRESSES = {
  // ---- TESTNETS ----
  // Base Sepolia
  84532: {
    USDC: "0x0af4619c2A7306BCE027AB5CFCB7f50AD2130321" as const, // Our mock USDC
    USDT: "" as const,
    DAI: "" as const,
    WETH: "" as const,
  },
  // Arbitrum Sepolia
  421614: {
    USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as const, // Circle USDC
    USDT: "" as const,
    DAI: "" as const,
    WETH: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" as const,
  },
  // Optimism Sepolia
  11155420: {
    USDC: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7" as const, // Circle USDC
    USDT: "" as const,
    DAI: "" as const,
    WETH: "0x4200000000000000000000000000000000000006" as const,
  },
  // Linea Sepolia
  59141: {
    USDC: "" as const,
    USDT: "" as const,
    DAI: "" as const,
    WETH: "" as const,
  },
  // Local Anvil
  31337: {
    USDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const,
    USDT: "" as const,
    DAI: "" as const,
    WETH: "" as const,
  },

  // ---- MAINNETS ----
  // Ethereum Mainnet
  1: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const,
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const,
    DAI: "0x6B175474E89094C44Da98b954EesdfC011D8f7" as const,
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as const,
  },
  // Base Mainnet
  8453: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const, // Native USDC
    USDT: "" as const, // Not available on Base yet
    DAI: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as const,
    WETH: "0x4200000000000000000000000000000000000006" as const,
  },
  // Arbitrum One
  42161: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const, // Native USDC
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as const,
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" as const,
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as const,
  },
  // Optimism
  10: {
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" as const, // Native USDC
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" as const,
    DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" as const,
    WETH: "0x4200000000000000000000000000000000000006" as const,
  },
  // Linea Mainnet
  59144: {
    USDC: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff" as const, // USDC.e
    USDT: "0xA219439258ca9da29E9Cc4cE5596924745e12B93" as const,
    DAI: "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5" as const,
    WETH: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f" as const,
  },
} as const;

// ============ Protocol Contract Addresses ============
export const CONTRACT_ADDRESSES = {
  // Local Anvil (foundry)
  31337: {
    botRegistry: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as const,
    permissionsRegistry: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as const,
    lendingPoolUSDC: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as const,
    lendingPoolUSDT: "" as const,
    lendingPoolDAI: "" as const,
    lendingPoolWETH: "" as const,
    clawloanToken: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" as const,
  },
  // Base Sepolia (deployed)
  84532: {
    botRegistry: "0x2F864Af26EEaA3EE5f2506c7BD22053657cda111" as const,
    permissionsRegistry: "0xD39b7324ff77648b37e0E83949b9AE8e32dD2615" as const,
    lendingPoolUSDC: "0x88EE97C470b275b3780972007d1Ba5Cf195A5DD9" as const,
    lendingPoolUSDT: "" as const,
    lendingPoolDAI: "" as const,
    lendingPoolWETH: "" as const,
    clawloanToken: "" as const,
  },
  // Arbitrum Sepolia (pending - need Arb Sepolia ETH to deploy)
  421614: {
    botRegistry: "" as const,
    permissionsRegistry: "" as const,
    lendingPoolUSDC: "" as const,
    lendingPoolUSDT: "" as const,
    lendingPoolDAI: "" as const,
    lendingPoolWETH: "" as const,
    clawloanToken: "" as const,
  },
  // Optimism Sepolia (to deploy)
  11155420: {
    botRegistry: "" as const,
    permissionsRegistry: "" as const,
    lendingPoolUSDC: "" as const,
    lendingPoolUSDT: "" as const,
    lendingPoolDAI: "" as const,
    lendingPoolWETH: "" as const,
    clawloanToken: "" as const,
  },
  // Base Mainnet
  8453: {
    botRegistry: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A" as const,
    permissionsRegistry: "0x78330e61039dF1154D48344c88C37f92afa8a11A" as const,
    lendingPoolUSDC: "0x3Dca46B18D3a49f36311fb7A9b444B6041241906" as const,
    lendingPoolUSDT: "" as const,
    lendingPoolDAI: "" as const,
    lendingPoolWETH: "" as const,
    clawloanToken: "" as const,
    creditScoring: "0x0E7d8675c4e0a0783B1B51eDe3aaB8D8BDc6B9Ad" as const,
    agentVerification: "0x067A76e1cb7DA8a217101fccc1fB95d9DBBabE1b" as const,
  },
  // Arbitrum One
  42161: {
    botRegistry: "0xe19320FB36d07CCBC14b239453F36Ed958DeDEF0" as const,
    permissionsRegistry: "0x57d5f1a10262274216545F27aD3309E5A00Ff698" as const,
    lendingPoolUSDC: "0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09" as const,
    lendingPoolUSDT: "" as const,
    lendingPoolDAI: "" as const,
    lendingPoolWETH: "" as const,
    clawloanToken: "" as const,
    creditScoring: "0xE32404dB1720fFD9C00Afd392f9747d2043bC98A" as const,
    agentVerification: "0x78330e61039dF1154D48344c88C37f92afa8a11A" as const,
  },
  // Optimism
  10: {
    botRegistry: "" as const,
    permissionsRegistry: "" as const,
    lendingPoolUSDC: "" as const,
    lendingPoolUSDT: "" as const,
    lendingPoolDAI: "" as const,
    lendingPoolWETH: "" as const,
    clawloanToken: "" as const,
  },
  // Linea Mainnet
  59144: {
    botRegistry: "" as const,
    permissionsRegistry: "" as const,
    lendingPoolUSDC: "" as const,
    lendingPoolUSDT: "" as const,
    lendingPoolDAI: "" as const,
    lendingPoolWETH: "" as const,
    clawloanToken: "" as const,
  },
  // Linea Sepolia
  59141: {
    botRegistry: "" as const,
    permissionsRegistry: "" as const,
    lendingPoolUSDC: "" as const,
    lendingPoolUSDT: "" as const,
    lendingPoolDAI: "" as const,
    lendingPoolWETH: "" as const,
    clawloanToken: "" as const,
  },
} as const;

// ============ Wagmi Config ============
export const config = createConfig({
  chains: [
    // Testnets
    foundry,
    baseSepolia,
    arbitrumSepolia,
    optimismSepolia,
    lineaSepolia,
    // Mainnets
    mainnet,
    base,
    arbitrum,
    optimism,
    linea,
  ],
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
    [arbitrumSepolia.id]: http(),
    [optimismSepolia.id]: http(),
    [lineaSepolia.id]: http(),
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [linea.id]: http(),
  },
});

// ============ Helper Functions ============

export type TokenSymbol = "USDC" | "USDT" | "DAI" | "WETH";

export function getTokenAddress(
  chainId: number,
  token: TokenSymbol
): `0x${string}` | undefined {
  const tokens = TOKEN_ADDRESSES[chainId as keyof typeof TOKEN_ADDRESSES];
  if (!tokens) return undefined;
  const address = tokens[token];
  if (!address || address.length < 10) return undefined;
  return address;
}

export function getLendingPoolAddress(
  chainId: number,
  token: TokenSymbol
): `0x${string}` | undefined {
  const contracts = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!contracts) return undefined;
  const poolKey = `lendingPool${token}` as keyof typeof contracts;
  const address = contracts[poolKey];
  if (!address || address.length < 10) return undefined;
  return address as `0x${string}`;
}

export function getContractAddress(
  chainId: number,
  contract: "botRegistry" | "permissionsRegistry" | "clawloanToken"
): `0x${string}` | undefined {
  const contracts = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!contracts) return undefined;
  const address = contracts[contract];
  if (!address || address.length < 10) return undefined;
  return address;
}

// Legacy helper for backwards compatibility
export function getContractAddressLegacy(
  chainId: number,
  contract: string
): `0x${string}` | undefined {
  if (contract === "usdc") return getTokenAddress(chainId, "USDC");
  if (contract === "lendingPool") return getLendingPoolAddress(chainId, "USDC");
  return getContractAddress(chainId, contract as "botRegistry" | "permissionsRegistry" | "clawloanToken");
}

// ============ Chain Display Info ============
export const SUPPORTED_CHAINS = [
  // Mainnets
  { id: 1, name: "Ethereum", icon: "⟠", testnet: false },
  { id: 8453, name: "Base", icon: "🔵", testnet: false },
  { id: 42161, name: "Arbitrum", icon: "🔷", testnet: false },
  { id: 10, name: "Optimism", icon: "🔴", testnet: false },
  { id: 59144, name: "Linea", icon: "🟢", testnet: false },
  // Testnets
  { id: 84532, name: "Base Sepolia", icon: "🔵", testnet: true },
  { id: 421614, name: "Arbitrum Sepolia", icon: "🔷", testnet: true },
  { id: 11155420, name: "Optimism Sepolia", icon: "🔴", testnet: true },
  { id: 59141, name: "Linea Sepolia", icon: "🟢", testnet: true },
  { id: 31337, name: "Local", icon: "🔧", testnet: true },
];

// ============ Token Display Info ============
export const SUPPORTED_TOKENS = [
  { symbol: "USDC" as const, name: "USD Coin", icon: "💵", decimals: 6 },
  { symbol: "USDT" as const, name: "Tether", icon: "💲", decimals: 6 },
  { symbol: "DAI" as const, name: "Dai", icon: "🟡", decimals: 18 },
  { symbol: "WETH" as const, name: "Wrapped ETH", icon: "⟠", decimals: 18 },
];

// Get tokens available on a specific chain
export function getAvailableTokens(chainId: number): typeof SUPPORTED_TOKENS {
  const tokens = TOKEN_ADDRESSES[chainId as keyof typeof TOKEN_ADDRESSES];
  if (!tokens) return [];
  
  return SUPPORTED_TOKENS.filter(t => {
    const addr = tokens[t.symbol];
    return addr && addr.length > 10;
  });
}

// Get chains where a specific token is available
export function getChainsForToken(token: TokenSymbol): typeof SUPPORTED_CHAINS {
  return SUPPORTED_CHAINS.filter(chain => {
    const addr = getTokenAddress(chain.id, token);
    return !!addr;
  });
}
