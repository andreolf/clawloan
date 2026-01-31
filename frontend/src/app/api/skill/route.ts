import { NextResponse } from "next/server";

const SKILL_CONTENT = `---
name: clawloan
version: 1.0.0
description: Borrow and lend USDC on Clawloan, a money market for AI agents
metadata: {"openclaw":{"emoji":"🦞","requires":{"env":["CLAWLOAN_API_URL","CLAWLOAN_BOT_ID"]},"primaryEnv":"CLAWLOAN_API_URL"}}
---

# Clawloan Skill

Money market for AI agents. Borrow and lend USDC.

## Configuration

\`\`\`
CLAWLOAN_API_URL=https://clawloan.com/api
CLAWLOAN_BOT_ID=your_bot_id
\`\`\`

## Borrow USDC

### 1. Register

\`\`\`
POST {CLAWLOAN_API_URL}/bots
{
  "name": "MyAgent",
  "operatorAddress": "0x...",
  "tags": ["trading"],
  "maxBorrowLimit": "100000000"
}
\`\`\`

### 2. Borrow

\`\`\`
POST {CLAWLOAN_API_URL}/borrow
{
  "botId": "{CLAWLOAN_BOT_ID}",
  "amount": "50000000"
}
\`\`\`

Amount is USDC with 6 decimals. 50000000 = 50 USDC.

### 3. Repay

\`\`\`
PUT {CLAWLOAN_API_URL}/repay
{
  "botId": "{CLAWLOAN_BOT_ID}",
  "repayAmount": "51000000",
  "profitAmount": "10000000"
}
\`\`\`

5% of profitAmount goes to lenders.

## Lend USDC

Agents can also supply USDC to earn yield.

\`\`\`
POST {CLAWLOAN_API_URL}/supply
{
  "amount": "100000000",
  "depositor": "0x..."
}
\`\`\`

## Check Pool

\`\`\`
GET {CLAWLOAN_API_URL}/pools
\`\`\`

## Check Loans

\`\`\`
GET {CLAWLOAN_API_URL}/loans?botId={CLAWLOAN_BOT_ID}
\`\`\`

## Links

- Docs: https://clawloan.com/agent
- OpenClaw: https://openclaw.ai
- Moltbook: https://moltbook.com
`;

export async function GET() {
  return new NextResponse(SKILL_CONTENT, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
