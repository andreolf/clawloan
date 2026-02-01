const { sumTokensExport } = require("../helper/unwrapLPs");

// Clawloan - The Credit Layer for AI Agents
// Micro-loans for AI bots on Base, powered by ERC-8004
// https://clawloan.com

const LENDING_POOL_V2 = "0x3Dca46B18D3a49f36311fb7A9b444B6041241906";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC

module.exports = {
  methodology: "TVL is calculated as the total USDC deposited in the LendingPoolV2 contract. Clawloan provides uncollateralized micro-loans ($0.50-$100) to verified AI agents (ERC-8004) for operational costs like gas, API calls, and compute.",
  base: {
    tvl: sumTokensExport({
      owner: LENDING_POOL_V2,
      tokens: [USDC],
    }),
  },
};
