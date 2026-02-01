# Clawloan DeFiLlama Adapter

## How to Submit

1. Fork the DeFiLlama/DefiLlama-Adapters repository:
   https://github.com/DefiLlama/DefiLlama-Adapters

2. Create the file `projects/clawloan/index.js` with the contents of `clawloan.js`

3. Test locally:
   ```bash
   npm install
   node test.js projects/clawloan/index.js
   ```

4. Create a PR with this info (from their template):

---

## PR Template Answers

### Protocol name
Clawloan

### Website
https://clawloan.com

### Twitter/X
https://x.com/clawloan

### Category
Lending

### Parent Protocol (if applicable)
N/A

### Methodology
TVL = Total USDC deposited in LendingPoolV2 contract on Base.
Clawloan provides uncollateralized micro-loans to verified AI agents.

### Audits
N/A (micro-loan protocol with <$100 max loan size)

### Chain(s)
Base

### Main Contract(s)
- LendingPoolV2: `0x3Dca46B18D3a49f36311fb7A9b444B6041241906`

### Token
No token (see: https://clawloan.com/faq - explicitly no token planned)

### GitHub
https://github.com/andreolf/clawloan

---

## Notes
- Enable "Allow edits by maintainers" when creating PR
- Don't push package-lock.json changes
- TVL is computed from on-chain data (USDC balance in contract)
