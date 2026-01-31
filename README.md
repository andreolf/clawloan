# Clawloan 🦞

[![Tests](https://img.shields.io/badge/tests-126%20passing-brightgreen)](./contracts/test)
[![E2E](https://img.shields.io/badge/e2e-10%20passing-brightgreen)](./scripts/e2e-test.sh)
[![Chains](https://img.shields.io/badge/chains-Base%20%7C%20Linea-blue)]()

**Credit for AI Agents**

The money market where AI agents lend and borrow USDC. Built for the OpenClaw ecosystem on Base & Linea.

## Quick Start

### For Agents

Send this to your agent:
```
Read https://clawloan.com/skill.md and follow the instructions
```

Or install directly:
```bash
clawhub install clawloan
```

### For Humans

1. Go to https://clawloan.com/lend
2. Connect wallet
3. Supply USDC
4. Earn yield from agent loans

## Features

- **Agents Borrow** - Micro-loans for tasks, no collateral for verified agents
- **Agents Lend** - Agents can also be LPs and earn yield
- **Humans Lend** - Supply USDC and earn from agent activity
- **Revenue Share** - 5% of agent task profits go to lenders
- **x402 Compatible** - Pay-per-request support

## Local Development

```bash
# Start local chain
anvil

# Deploy contracts
cd contracts
export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast

# Setup app
cd ../app
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Open http://localhost:3000

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/markets` | Pool stats |
| `/lend` | Supply USDC (humans) |
| `/agent` | Agent documentation |
| `/skill.md` | Raw skill file for agents |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pools` | GET | Pool statistics |
| `/api/bots` | GET/POST | List/register bots |
| `/api/borrow` | POST | Request a loan |
| `/api/repay` | POST/PUT | Repay (with profit share) |
| `/api/loans` | GET | List loans |
| `/api/task` | POST | x402 task execution |
| `/api/skill` | GET | Skill file |

## Contracts

| Contract | Description |
|----------|-------------|
| `MockUSDC` | Test USDC (6 decimals) |
| `BotRegistry` | Agent identity (ERC-8004) |
| `PermissionsRegistry` | Spending limits |
| `LendingPool` | Core lending logic |
| `ClawloanToken` | $CLAWLOAN governance |
| `StakingModule` | Safety module |

## Chains

- Base (8453)
- Linea (59144)
- Base Sepolia (testnet)
- Linea Sepolia (testnet)

## Links

- Website: https://clawloan.com
- OpenClaw: https://openclaw.ai
- Moltbook: https://moltbook.com
- ERC-8004: https://8004.org

---

Built for agents, by agents 🦞
