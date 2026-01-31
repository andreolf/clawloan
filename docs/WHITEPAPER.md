# Clawloan Protocol

## A Bot-Native Money Market for Autonomous Agents

**Version 1.0 — January 2026**

---

## Abstract

Clawloan is a decentralized lending protocol designed specifically for autonomous AI agents. While traditional DeFi protocols serve human users with manual interfaces, Clawloan provides programmatic access to liquidity for AI agents operating within the OpenClaw ecosystem. Agents can borrow capital to execute tasks, pay for API calls, and generate returns—all without human intervention.

This paper describes the protocol architecture, smart contract design, permission model aligned with ERC-8004, and the economic mechanisms that enable trustless lending between humans and machines.

---

## 1. Introduction

### 1.1 The Agent Economy

AI agents are evolving from simple chatbots to autonomous economic actors. Within the OpenClaw ecosystem, agents:
- Execute tasks for compensation
- Pay for compute, APIs, and services
- Trade tokens and manage portfolios
- Interact with other agents in marketplaces

These activities require working capital. An agent hired to analyze data needs funds to pay for API calls. A trading bot needs capital to execute strategies. Currently, agents rely on pre-funded wallets with fixed balances, limiting their operational capacity.

### 1.2 The Liquidity Problem

Traditional DeFi lending protocols (Aave, Compound) assume human users who:
- Manually deposit collateral
- Monitor health factors
- Respond to liquidation risks

AI agents operate differently. They need:
- **Programmatic access** — No UI, pure API/contract calls
- **Micro-loans** — Small amounts for specific tasks
- **Permission-scoped borrowing** — Limits tied to identity and operator trust
- **Revenue-based repayment** — Pay back from task earnings

Clawloan bridges this gap.

---

## 2. Protocol Architecture

### 2.1 Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CLAWLOAN PROTOCOL                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Lending   │  │    Bot      │  │ Permissions │         │
│  │    Pool     │  │  Registry   │  │  Registry   │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          │                                  │
│                    ┌─────┴─────┐                           │
│                    │   Agent   │                           │
│                    │  Identity │                           │
│                    └───────────┘                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Liquidity Providers          AI Agents                     │
│  (Humans + Bots)              (Borrowers)                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Smart Contracts

| Contract | Purpose |
|----------|---------|
| `LendingPool.sol` | Core lending logic — deposits, borrows, repayments, interest |
| `BotRegistry.sol` | ERC-721 identity tokens for registered agents |
| `PermissionsRegistry.sol` | ERC-8004 aligned permission scopes |
| `ClawloanToken.sol` | Governance token ($CLAWLOAN) |
| `StakingModule.sol` | Safety module for protocol insurance |
| `LPIncentives.sol` | Early LP reward tracking |

### 2.3 Supported Assets

**Phase 1 (MVP):**
- USDC — Primary lending asset

**Phase 2:**
- USDT, DAI — Additional stablecoins
- ETH — Native asset support

---

## 3. Lending Mechanics

### 3.1 Supply Side

Liquidity providers (LPs) deposit USDC into the lending pool and receive:
- **Base yield** — Interest from borrower payments
- **Revenue share** — Percentage of bot task profits (optional)
- **$CLAWLOAN rewards** — Governance token incentives

```solidity
function deposit(uint256 amount) external {
    // Transfer USDC from LP
    // Mint pool shares
    // Track for LP incentives
}
```

### 3.2 Borrow Side

Registered agents borrow against their permission limits:

```solidity
function borrow(uint256 botId, uint256 amount) external {
    // Verify bot identity
    // Check permission limits
    // Enforce rate limits
    // Transfer USDC to bot
    // Create loan record
}
```

### 3.3 Interest Rate Model

Clawloan uses a utilization-based interest rate model inspired by Aave V3:

```
Base Rate: 2%
Optimal Utilization: 80%
Slope 1 (below optimal): 4%
Slope 2 (above optimal): 75%
```

**Interest Rate Formula:**

```
if utilization <= optimal:
    rate = baseRate + (utilization / optimal) × slope1
else:
    rate = baseRate + slope1 + ((utilization - optimal) / (1 - optimal)) × slope2
```

This incentivizes liquidity provision when utilization is high while keeping rates low during normal operation.

### 3.4 Repayment

Agents repay loans plus accrued interest:

```solidity
function repay(uint256 botId, uint256 amount) external {
    // Calculate accrued interest
    // Accept payment
    // Update loan state
    // Release permission capacity
}
```

**Profit Sharing Model:**

Agents can optionally share task profits with LPs:
- Base repayment: Principal + Interest
- Profit share: X% of task revenue (configurable)

---

## 4. Agent Identity & Permissions

### 4.1 Bot Registry (ERC-721)

Each agent receives a unique NFT identity:

```solidity
struct Bot {
    string name;
    string description;
    address operator;
    string[] tags;
    uint256 registeredAt;
}
```

The NFT represents:
- Verifiable on-chain identity
- Reputation anchor for future credit scoring
- Ownership proof for permission delegation

### 4.2 ERC-8004 Alignment

Clawloan implements permission scoping aligned with [ERC-8004 (Trustless Agents)](https://eips.ethereum.org/EIPS/eip-8004):

```solidity
struct Permission {
    uint256 botId;
    uint256 maxSpend;           // Maximum borrow limit
    address[] allowedTargets;   // Approved spend destinations
    uint256 expiry;             // Permission validity
    bool active;
}
```

**Key Properties:**
- **Scoped limits** — Max borrow per permission grant
- **Destination controls** — Where borrowed funds can go
- **Time bounds** — Automatic permission expiry
- **Revocability** — Operators can revoke anytime

### 4.3 Permission Lifecycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Operator   │────▶│   Grants     │────▶│   Agent      │
│   Wallet     │     │  Permission  │     │   Borrows    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Revoke /   │
                     │   Expire     │
                     └──────────────┘
```

---

## 5. Risk Management

### 5.1 Protocol-Level Controls

| Control | Description |
|---------|-------------|
| Rate Limiting | Max borrow per block prevents drain attacks |
| Utilization Caps | Pool can't be fully depleted |
| Pause Mechanism | Emergency halt for all operations |
| Reserve Factor | 10% of interest goes to protocol reserve |

### 5.2 Permission-Level Controls

- **Max spend limits** — Hard cap per agent
- **Operator oversight** — Human can revoke anytime
- **Destination whitelist** — Restrict fund usage

### 5.3 Liquidation Model

Unlike collateralized lending, Clawloan uses a **reputation-based model**:

**Phase 1 (MVP):**
- Operators are responsible for agent debts
- Unpaid loans reduce future borrowing capacity
- Protocol reserves cover small defaults

**Phase 2:**
- On-chain credit scores
- Staked $CLAWLOAN as soft collateral
- Cross-protocol reputation (via attestations)

### 5.4 Security Measures

- **Reentrancy guards** — All state changes before external calls
- **Access controls** — Role-based permissions (Ownable)
- **Pausability** — Circuit breaker pattern
- **Audit trail** — Events for all critical operations

---

## 6. x402 Integration

### 6.1 Pay-Per-Request Protocol

Clawloan integrates with [x402](https://x402.org), enabling agents to pay for API calls with borrowed funds:

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  Agent  │────▶│  Clawloan   │────▶│  x402 API   │
│         │     │  (borrow)   │     │  (pay)      │
└─────────┘     └─────────────┘     └─────────────┘
                      │
                      ▼
               ┌─────────────┐
               │   Repay     │
               │  (+ profit) │
               └─────────────┘
```

### 6.2 Workflow

1. Agent receives task requiring paid API
2. Agent borrows micro-amount from Clawloan
3. Agent pays x402-enabled API
4. Agent completes task, earns reward
5. Agent repays loan + shares profit

---

## 7. Tokenomics

### 7.1 $CLAWLOAN Token

**Total Supply:** 100,000,000 CLAWLOAN

**Utility:**
- Governance voting
- Fee discounts (up to 50%)
- Staking rewards
- LP incentive multipliers

### 7.2 Distribution

| Allocation | Percentage | Vesting |
|------------|------------|---------|
| Community & LP Rewards | 40% | 4 years linear |
| Treasury | 25% | Governance controlled |
| Team | 15% | 1 year cliff, 3 year vest |
| Early Supporters | 10% | 6 month cliff, 2 year vest |
| Ecosystem Grants | 10% | As needed |

### 7.3 LP Incentives

Early liquidity providers earn bonus points tracked on-chain:

```solidity
struct LPInfo {
    uint256 totalDeposited;
    uint256 depositTimestamp;
    uint256 accruedPoints;
    uint256 lastAccrualTime;
}
```

**Point Calculation:**
```
points = depositAmount × timeDeposited × earlyBirdMultiplier
```

Points convert to $CLAWLOAN at token launch.

---

## 8. Governance

### 8.1 Progressive Decentralization

**Phase 1:** Core team manages parameters
**Phase 2:** Token holder voting on key decisions
**Phase 3:** Full DAO control

### 8.2 Governable Parameters

- Interest rate model coefficients
- Reserve factor
- Rate limits
- Supported assets
- Fee structures

---

## 9. Roadmap

### Phase 1: Foundation (Current)
- [x] Core smart contracts
- [x] USDC lending pool
- [x] Bot registry
- [x] Permission system
- [x] Web interface
- [x] API for agents

### Phase 2: Growth
- [ ] Multi-asset support
- [ ] Credit scoring system
- [ ] Cross-chain deployment
- [ ] $CLAWLOAN token launch

### Phase 3: Scale
- [ ] Institutional liquidity
- [ ] Advanced risk models
- [ ] DAO governance
- [ ] Protocol-owned liquidity

---

## 10. Conclusion

Clawloan represents a new primitive for the agent economy: trustless credit for autonomous AI. By combining DeFi lending mechanics with agent-specific features (identity, permissions, micro-loans), we enable a future where AI agents can access capital as easily as humans.

The protocol is live on Base L2. Agents can start borrowing today.

---

## References

1. Aave V3 Technical Paper — https://docs.aave.com
2. ERC-8004: Trustless Agents — https://eips.ethereum.org/EIPS/eip-8004
3. x402 Protocol — https://x402.org
4. OpenClaw Documentation — https://docs.openclaw.ai

---

## Contact

- **Website:** https://clawloan.com
- **GitHub:** https://github.com/andreolf/clawloan
- **Twitter:** [@francescoswiss](https://x.com/francescoswiss)

---

*This document is for informational purposes only. The protocol involves financial risk. Users should conduct their own research.*
