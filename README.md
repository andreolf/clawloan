# Clawloan 🦞

[![Tests](https://img.shields.io/badge/tests-126%20passing-brightgreen)](./contracts/test)
[![E2E](https://img.shields.io/badge/e2e-10%20passing-brightgreen)](./scripts/e2e-test.sh)
[![Chains](https://img.shields.io/badge/chains-Base%20%7C%20Linea-blue)]()

**Credit for AI Agents**

The money market where AI agents lend and borrow USDC. Built for the OpenClaw ecosystem on Base & Linea.

## Repository Structure

```
clawloan/
├── frontend/          # Next.js app (UI + API routes)
│   ├── src/
│   │   ├── app/       # Pages & API routes
│   │   ├── components/# React components
│   │   └── lib/       # Utilities
│   └── prisma/        # Database schema
├── contracts/         # Solidity smart contracts
│   ├── src/           # Contract source
│   ├── test/          # Foundry tests
│   └── script/        # Deploy scripts
├── docs/              # Documentation
│   └── TECHNICAL_PAPER.md  # Technical paper
├── scripts/           # Utility scripts
│   └── e2e-test.sh    # End-to-end tests
└── skills/            # Agent skills
    └── clawloan/      # OpenClaw skill
```

## Quick Start

### For Agents

Send this to your agent:
```
Read https://clawloan.com/skill.md and follow the instructions
```

### For Humans

1. Go to https://clawloan.com/lend
2. Connect wallet
3. Supply USDC
4. Earn yield from agent loans

## Local Development

```bash
# 1. Start local blockchain
anvil

# 2. Deploy contracts
cd contracts
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# 3. Run frontend
cd ../frontend
npm install
cp .env.example .env  # Configure database
npx prisma db push
npm run dev
```

Open http://localhost:3000

## Smart Contracts

| Contract | Description |
|----------|-------------|
| `LendingPoolV2.sol` | Core lending logic with liquidation & flash borrows |
| `BotRegistry.sol` | Agent identity (ERC-721) |
| `PermissionsRegistry.sol` | ERC-8004 permission scopes |
| `CreditScoring.sol` | On-chain credit history |
| `AgentVerification.sol` | Identity verification levels |
| `LPIncentives.sol` | Early LP reward tracking |
| `MockUSDC.sol` | Test USDC (6 decimals) |

> ⚠️ **No Token:** There is no $CLAWLOAN token. Any tokens are scams. See [clawloan.com](https://clawloan.com) for official info.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pools` | GET | Pool statistics |
| `/api/bots` | GET/POST | List/register agents |
| `/api/borrow` | POST | Request a loan |
| `/api/repay` | POST | Repay loan |
| `/api/loans` | GET | List loans |
| `/api/health` | GET | Protocol health |
| `/api/stats` | GET | Protocol metrics |

## Supported Chains

- Base (8453)
- Linea (59144)
- Base Sepolia (84532) - testnet
- Linea Sepolia (59141) - testnet

## Links

- **Website:** https://clawloan.com
- **Docs:** https://clawloan.com/docs
- **Technical Paper:** [docs/TECHNICAL_PAPER.md](./docs/TECHNICAL_PAPER.md)
- **OpenClaw:** https://openclaw.ai
- **Twitter:** [@clawloan](https://x.com/clawloan)

---

Built for agents, by agents 🦞
