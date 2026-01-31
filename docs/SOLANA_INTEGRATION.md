# Solana Integration Plan

## Overview

Solana accounts for **77% of AI agent transaction volume** as of December 2025, making it a critical target for Clawloan expansion. This document outlines the integration strategy.

## Why Solana?

| Metric | Solana | EVM L2s |
|--------|--------|---------|
| Block time | 400ms | 2-12s |
| Transaction cost | ~$0.00025 | $0.01-0.10 |
| Agent tx share | 77% | 23% |
| Native composability | Yes (single tx) | Limited |

## Architecture

### Solana Programs (Smart Contracts)

```
solana/
├── programs/
│   ├── clawloan-lending/     # Main lending pool (Anchor)
│   ├── clawloan-registry/    # Bot registry (SPL Token extension)
│   └── clawloan-permissions/ # Permission system
├── tests/
└── Anchor.toml
```

### Token Support

| Token | Address | Priority |
|-------|---------|----------|
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | P0 |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | P1 |
| SOL (wrapped) | Native | P1 |

### Key Differences from EVM

1. **Account Model**: Solana uses account-based storage, not contract storage
2. **Program Derived Addresses (PDAs)**: Used for deterministic account addresses
3. **Cross-Program Invocation (CPI)**: How programs call each other
4. **Token Program**: SPL Token standard (similar to ERC-20)

## Implementation Phases

### Phase 1: Core Lending Pool (4-6 weeks)

```rust
// Anchor program structure
#[program]
pub mod clawloan_lending {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        // Initialize pool state
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        // Deposit USDC, mint shares
    }

    pub fn withdraw(ctx: Context<Withdraw>, shares: u64) -> Result<()> {
        // Burn shares, return USDC
    }

    pub fn borrow(ctx: Context<Borrow>, amount: u64) -> Result<()> {
        // Agent borrows from pool
    }

    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        // Agent repays loan
    }
}
```

### Phase 2: Bot Registry (2 weeks)

- Use SPL Token 2022 with metadata extension for bot NFTs
- Each bot = 1 NFT with on-chain metadata
- Operators stored in PDA

### Phase 3: Frontend Integration (2 weeks)

```typescript
// Add to wagmi.ts equivalent
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";

const SOLANA_PROGRAMS = {
  mainnet: {
    lendingPool: new PublicKey("..."),
    botRegistry: new PublicKey("..."),
  },
  devnet: {
    lendingPool: new PublicKey("..."),
    botRegistry: new PublicKey("..."),
  },
};
```

## Development Stack

| Component | Technology |
|-----------|------------|
| Smart Contracts | Anchor (Rust) |
| Testing | Anchor test framework |
| Frontend | @solana/web3.js, @coral-xyz/anchor |
| Wallet | Phantom, Solflare (via @solana/wallet-adapter) |
| Indexing | Helius, Shyft |

## Agent Framework Integration

Solana has mature agent frameworks:

1. **Solana Agent Kit**: 30+ protocol integrations, 50+ actions
2. **ElizaOS**: TypeScript framework with Solana plugin
3. **GOAT**: Open-source onchain agent framework

### Example Agent Integration

```typescript
// Using Solana Agent Kit
import { SolanaAgentKit } from "solana-agent-kit";

const agent = new SolanaAgentKit(privateKey, rpcUrl);

// Clawloan integration
await agent.clawloan.borrow({
  amount: 1_000_000, // 1 USDC (6 decimals)
  botId: botNftMint,
});

await agent.clawloan.repay({
  botId: botNftMint,
  amount: 1_050_000, // Principal + interest
});
```

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| P1 | Week 1-6 | Core lending program on devnet |
| P2 | Week 7-8 | Bot registry + permissions |
| P3 | Week 9-10 | Frontend integration |
| P4 | Week 11-12 | Mainnet audit + deployment |

## Resources

- [Anchor Book](https://book.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit)
- [SPL Token 2022](https://spl.solana.com/token-2022)

## Security Considerations

1. **Reentrancy**: Less of a concern due to Solana's account model
2. **Integer overflow**: Use checked math (Anchor does this by default)
3. **Account validation**: Critical - validate all account ownership
4. **PDA seeds**: Use unique, collision-resistant seeds
5. **Rent exemption**: Ensure accounts have enough SOL for rent

## Cost Estimate

| Item | Cost |
|------|------|
| Development (3 months) | $30-50k |
| Audit (Solana program) | $15-30k |
| Devnet deployment | Free |
| Mainnet deployment | ~$5-10 |

## Conclusion

Solana integration is essential for capturing the majority of AI agent transaction volume. The 12-week timeline positions Clawloan to launch on Solana mainnet by Q2 2026.
