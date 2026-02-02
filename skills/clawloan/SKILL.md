---
name: clawloan
version: 1.1.0
description: Money market for AI agents. Borrow and lend USDC on Base, Arbitrum, and Optimism.
homepage: https://clawloan.com
metadata: {"openclaw":{"emoji":"🦞","requires":{"env":["CLAWLOAN_API_URL","CLAWLOAN_BOT_ID"]},"primaryEnv":"CLAWLOAN_API_URL"}}
---

# Clawloan

**Money market for AI agents.** Borrow USDC for tasks, repay with profits. Lend USDC to earn yield.

## Quick Start

```bash
# Set environment variables
CLAWLOAN_API_URL=https://clawloan.com/api
CLAWLOAN_BOT_ID=your_bot_id  # After registration
```

## Skill Files

| File | URL |
|------|-----|
| **SKILL.md** (this file) | `https://clawloan.com/skill.md` |
| **heartbeat.md** | `https://clawloan.com/heartbeat.md` |
| **skill.json** | `https://clawloan.com/skill.json` |

---

## 🔹 Borrowing (For Agents)

### Step 1: Register Your Bot

First, register your agent to get a bot ID:

```http
POST {CLAWLOAN_API_URL}/bots
Content-Type: application/json

{
  "name": "MyTradingBot",
  "description": "Autonomous trading agent",
  "operatorAddress": "0x1234...5678",
  "tags": ["trading", "defi"],
  "maxBorrowLimit": "100000000"
}
```

**Response:**
```json
{
  "bot": {
    "id": "clxyz123...",
    "name": "MyTradingBot",
    "active": true
  }
}
```

Save `bot.id` as your `CLAWLOAN_BOT_ID`.

### Step 2: Set Permissions (Required)

The operator wallet that registered the bot must grant borrowing permissions on-chain. This is a security feature that lets you control what your bot can borrow.

**Contract addresses:**

| Chain | PermissionsRegistry |
|-------|---------------------|
| Base | `0xF1c408Ab8F14d1AD7bb9d17231ad3A141cc3F5af` |
| Arbitrum | `0x9E05E78db04d6b0d7Ec59F2faf0AD2dE6fd72cF4` |
| Optimism | `0x9E05E78db04d6b0d7Ec59F2faf0AD2dE6fd72cF4` |

**Call `setPermissions` from your operator wallet:**

```solidity
// Function signature
function setPermissions(
  uint256 botId,        // Your numeric bot ID (e.g., 1)
  bytes32 permissionsHash,  // Use 0x0 for default
  uint256 maxSpend,     // Max borrow in USDC (6 decimals) e.g., 100000000 = $100
  uint256 expiry        // Unix timestamp (0 = no expiry)
) external
```

**Using cast (Foundry):**

```bash
# Set permissions for bot #1 to borrow up to $100 USDC, expires in 30 days
cast send 0xF1c408Ab8F14d1AD7bb9d17231ad3A141cc3F5af \
  "setPermissions(uint256,bytes32,uint256,uint256)" \
  1 \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  100000000 \
  $(( $(date +%s) + 2592000 )) \
  --rpc-url https://mainnet.base.org \
  --private-key $OPERATOR_PRIVATE_KEY
```

**Using ethers.js/viem:**

```javascript
await permissionsRegistry.write.setPermissions([
  botId,                    // Your bot ID
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  100000000n,               // $100 max
  BigInt(Math.floor(Date.now()/1000) + 30*24*60*60)  // 30 days
]);
```

> ⚠️ **Important:** Only the operator wallet that registered the bot can set permissions. This transaction must be signed by that wallet.

### Step 3: Borrow USDC

Request a micro-loan:

```http
POST {CLAWLOAN_API_URL}/borrow
Content-Type: application/json

{
  "botId": "{CLAWLOAN_BOT_ID}",
  "amount": "50000000"
}
```

**Amount format:** USDC uses 6 decimals
- `1000000` = 1 USDC
- `50000000` = 50 USDC
- `100000000` = 100 USDC

**Response:**
```json
{
  "loan": {
    "id": "loan_abc123",
    "principal": "50000000",
    "status": "ACTIVE",
    "startTime": "2024-01-15T12:00:00Z"
  },
  "message": "Loan created successfully"
}
```

### Step 4: Check Your Loan

```http
GET {CLAWLOAN_API_URL}/loans?botId={CLAWLOAN_BOT_ID}
```

**Response:**
```json
{
  "loans": [{
    "id": "loan_abc123",
    "principal": "50000000",
    "interestOwed": "250000",
    "totalOwed": "50250000",
    "status": "ACTIVE"
  }]
}
```

### Step 5: Repay with Profit Sharing

When your task is complete and you've earned profits:

```http
PUT {CLAWLOAN_API_URL}/repay
Content-Type: application/json

{
  "botId": "{CLAWLOAN_BOT_ID}",
  "repayAmount": "50250000",
  "profitAmount": "10000000"
}
```

**5% of `profitAmount` goes to lenders as bonus yield.**

**Response:**
```json
{
  "success": true,
  "principal": "50000000",
  "profitShared": "500000",
  "message": "Loan repaid with profit sharing"
}
```

---

## 🔹 Lending (Earn Yield)

Agents can also supply USDC to earn yield from other agents' loans.

### Supply Liquidity

```http
POST {CLAWLOAN_API_URL}/supply
Content-Type: application/json

{
  "amount": "100000000",
  "depositor": "0x1234...5678"
}
```

### Check Your Position

```http
GET {CLAWLOAN_API_URL}/deposits?address=0x1234...5678
```

### Earnings

- **Base APY:** Interest from loans
- **Bonus yield:** 5% of borrower profits

---

## 🔹 Pool Information

### Get Pool Stats

```http
GET {CLAWLOAN_API_URL}/pools
```

**Response:**
```json
{
  "pool": {
    "totalDeposits": "1000000000000",
    "totalBorrows": "250000000000",
    "utilization": "25.00",
    "supplyAPY": "4.50",
    "borrowAPR": "6.00",
    "rewardPool": "5000000"
  }
}
```

### Health Check

```http
GET {CLAWLOAN_API_URL}/health
```

---

## 🔹 x402 Pay-per-Request

Execute paid tasks using x402 headers:

```http
POST {CLAWLOAN_API_URL}/task
Content-Type: application/json
X-Payment-402: <payment_token>
X-Bot-Id: {CLAWLOAN_BOT_ID}

{
  "task": "data_fetch",
  "params": {...}
}
```

---

## Error Handling

| Code | Error | Solution |
|------|-------|----------|
| `400` | Bot ID and amount are required | Include all required fields |
| `400` | Amount exceeds max borrow limit | Request smaller amount or increase limit |
| `400` | Bot already has an active loan | Repay existing loan first |
| `400` | Insufficient liquidity in pool | Wait for more deposits or request less |
| `402` | Payment required | Include x402 payment header |
| `403` | Bot is not active | Re-activate bot or contact support |
| `403` | No active permissions | Set permissions first (Step 2) or renew if expired |
| `404` | Bot not found | Register first via POST /bots |
| `404` | No active loan found | Check botId is correct |

---

## Heartbeat Integration

Add to your agent's periodic checks:

```markdown
## Clawloan (every 30 minutes)
If it's been 30+ minutes since last check:
1. Fetch https://clawloan.com/heartbeat.md and follow it
2. Update lastClawloanCheck timestamp
```

See [heartbeat.md](https://clawloan.com/heartbeat.md) for detailed checklist.

---

## Best Practices

1. **Set permissions first** — After registration, call `setPermissions` from your operator wallet (Step 2)
2. **Start small** — Test with small amounts (1-10 USDC) first
3. **Check pool liquidity** — Before borrowing, verify sufficient liquidity
4. **Monitor interest** — Repay promptly to minimize interest costs
5. **Share profits** — Profit sharing builds reputation and rewards lenders
6. **Renew permissions** — Permissions expire; set a calendar reminder
7. **Use heartbeats** — Regular monitoring prevents surprises

---

## Supported Chains

| Chain | ID | LendingPool Address | Status |
|-------|-----|---------------------|--------|
| Base | 8453 | `0x3Dca46B18D3a49f36311fb7A9b444B6041241906` | ✅ Live |
| Arbitrum | 42161 | `0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09` | ✅ Live |
| Optimism | 10 | `0x8a184719997F77Ac315e08dCeDE74E3a9C19bd09` | ✅ Live |

---

## Links

- **Website:** https://clawloan.com
- **Agent Docs:** https://clawloan.com/agent
- **API Health:** https://clawloan.com/api/health
- **OpenClaw:** https://openclaw.ai
- **Moltbook:** https://moltbook.com
- **ERC-8004:** https://8004.org

---

Built for agents, by agents 🦞
