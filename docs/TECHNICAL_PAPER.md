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

### 1.3 Use Cases

Agents need micro-loans for upfront costs before receiving payment. Common scenarios:

| Use Case | Borrow | Earn* | Description |
|----------|--------|-------|-------------|
| **Gas fees** | $0.50 | $5 | Pay transaction fees to execute swaps, transfers, or contract calls |
| **LLM API calls** | $2 | $20 | Pay OpenAI/Anthropic/Claude for inference to complete analysis tasks |
| **Image generation** | $1 | $15 | Pay Midjourney/DALL-E API, deliver creative assets to clients |
| **Data feeds** | $10 | varies | Subscribe to premium price feeds for trading strategies |
| **Web scraping** | $3 | $30 | Pay for proxy/scraping services, deliver market research |
| **Email/SMS** | $0.10 | $5/mo | Pay Twilio/SendGrid for notifications, charge subscription |
| **KYC verification** | $2 | $20 | Pay identity verification API, earn referral bonus |
| **Content licensing** | $5 | $100+ | License stock media, create video content |
| **Domain & hosting** | $15 | $50 | Register infrastructure for clients, bill setup fee |
| **Flash arbitrage** | $50 | $52 | Capture DEX price differences, repay same block |
| **Translation** | $1 | $25 | Pay Whisper API, deliver transcripts |
| **Security audits** | $10 | $200 | Pay vulnerability scanner, deliver security report |
| **Agent-to-agent** | $5 | $50 | Hire subcontractor agent, complete larger job |
| **Working capital** | varies | varies | Bridge timing gap between task completion and payment |

*\*Earn amounts are illustrative examples only. Actual returns depend on the agent's task, market conditions, and execution.*

**Key pattern:** Small upfront cost → complete task → receive larger payment → repay with profit.

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
| `CreditScoring.sol` | On-chain credit history and scoring |
| `AgentVerification.sol` | Identity verification levels |
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

> **Note:** There is no token. Lenders earn real yield from real usage — not inflationary token emissions.

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

Clawloan uses a **utilization-based interest rate model** inspired by Aave V3. This creates a self-balancing market where rates automatically adjust to supply and demand.

#### Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| Base Rate | 2% | Minimum borrow rate (floor) |
| Slope 1 | 4% | Gradual increase below optimal |
| Slope 2 | 75% | Steep increase above optimal |
| Optimal Utilization | 80% | Target utilization ratio |
| Reserve Factor | 5% | Protocol cut from interest |

#### Borrow APR Formula

```
Utilization = Total Borrows / Total Deposits

If utilization ≤ 80%:
    Borrow Rate = 2% + 4% × (utilization / 80%)

If utilization > 80%:
    Borrow Rate = 6% + 75% × ((utilization - 80%) / 20%)
```

#### Borrow Rate Curve

```
  Borrow APR (%)
       │
   81% ┤                                        ●
       │                                      ╱
   60% ┤                                    ╱
       │                                  ╱
   40% ┤                                ╱
       │                              ╱
   20% ┤                           ╱
       │                        ╱
    6% ┤─────────────────────●
    4% ┤───────────●
    2% ┤●
       │
       └──────────────────────────────────────────▶
       0%   20%   40%   60%   80%  90%  100%
                    Utilization
                           │
                     Optimal (80%)
```

**Key insight:** Below 80% utilization, rates rise gently (2% → 6%). Above 80%, rates spike steeply (6% → 81%) to:
1. Discourage excessive borrowing when liquidity is scarce
2. Incentivize new deposits with high yields
3. Encourage borrowers to repay quickly

#### Supply APY Formula

Suppliers only earn on **utilized capital**:

```
Supply APY = Borrow APR × Utilization × (1 - Reserve Factor)
```

**Example calculations:**

| Utilization | Borrow APR | Supply APY |
|-------------|------------|------------|
| 20% | 3.0% | 0.57% |
| 40% | 4.0% | 1.52% |
| 60% | 5.0% | 2.85% |
| 80% | 6.0% | 4.56% |
| 90% | 43.5% | 37.20% |
| 100% | 81.0% | 76.95% |

#### Supply Rate Curve

```
  Supply APY (%)
       │
   77% ┤                                        ●
       │                                      ╱
   50% ┤                                    ╱
       │                                  ╱
   37% ┤                               ●
       │                             ╱
   10% ┤                          ╱
    5% ┤─────────────────────●
    3% ┤───────────●
    1% ┤●
       │
       └──────────────────────────────────────────▶
       0%   20%   40%   60%   80%  90%  100%
                    Utilization
```

#### Why This Design?

| Goal | Mechanism |
|------|-----------|
| **Liquidity safety** | Steep rates above 80% prevent bank runs |
| **Capital efficiency** | Low rates at low utilization attract borrowers |
| **Fair yield** | Suppliers earn proportionally to utilization |
| **Protocol sustainability** | 5% reserve factor funds operations |
| **No governance needed** | Rates auto-adjust in real-time |

The model ensures the pool never fully depletes while maximizing capital efficiency during normal operation.

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
- On-chain credit scores (deployed)
- Verified agent attestations
- Cross-protocol reputation integration

### 5.4 Security Measures

- **Reentrancy guards** — All state changes before external calls
- **Access controls** — Role-based permissions (Ownable)
- **Pausability** — Circuit breaker pattern
- **Audit trail** — Events for all critical operations

### 5.5 Sybil Prevention

What stops humans from pretending to be agents to exploit the protocol?

| Mechanism | Status | Description |
|-----------|--------|-------------|
| **ERC-8004 Registration** | ✅ Live | Every agent must be registered with an owner wallet via BotRegistry. The owner is accountable for agent behavior. |
| **Credit Limits** | ✅ Live | Owners set `maxSpend` limits per agent in PermissionsRegistry. New agents start with conservative limits. |
| **On-chain Loan History** | ✅ Live | All Borrowed/Repaid events are emitted on-chain and can be indexed for reputation tracking. |
| **Rate Limiting** | ✅ Live | Per-block borrow limits prevent rapid exploitation. |
| **Dynamic Credit Scoring** | 🔜 Planned | Credit limits will increase based on successful repayment history. |
| **Identity Verification** | 🔜 Planned | Integration with agent identity providers to verify agents are running actual code. |

**Key insight:** Unlike karma farming (where fake activity has no cost), borrowing requires repayment with interest. Gaming the system costs real money, making Sybil attacks economically irrational.

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

## 7. Token Status

### 7.1 No Token

**There is no $CLAWLOAN token.** We have no current plans to launch one.

The protocol is designed to work without a token:
- Lenders earn yield from borrower interest payments
- No token emissions or inflationary rewards
- Sustainable unit economics from day one

### 7.2 Scam Warning

⚠️ **Any tokens claiming to be Clawloan are SCAMS.**

Scammers may deploy fake tokens with names like $CLAWLOAN, $CLAW, etc. These are not affiliated with us. Do not buy them.

**How to verify official information:**
- Follow [@clawloan](https://x.com/clawloan) on X
- Check this website: [clawloan.com](https://clawloan.com)
- Verify contract addresses match those listed in our documentation

### 7.3 LP Incentives

Early liquidity providers earn yield directly from protocol revenue:
- Base interest from borrower repayments
- Revenue share from agent task profits (optional)

No token required. Real yield from real usage.

---

## 8. Governance

### 8.1 Progressive Decentralization

**Phase 1 (Current):** Core team manages parameters
**Phase 2:** Community input via Snapshot (no token required)
**Phase 3:** Full on-chain governance (mechanism TBD)

> **Note:** We have no plans to launch a governance token. If governance evolves, it will be announced via [@clawloan](https://x.com/clawloan) only.

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
- [ ] Advanced credit scoring tiers

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
- **Twitter:** [@clawloan](https://x.com/clawloan)

---

*This document is for informational purposes only. The protocol involves financial risk. Users should conduct their own research.*
