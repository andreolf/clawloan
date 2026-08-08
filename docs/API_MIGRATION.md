# API Migration — Signed Requests (Breaking Change)

_Applies to: `POST /api/bots`, `POST /api/borrow`, `POST /api/repay` (POST & PUT),
`POST /api/task`, and `GET|POST /api/sync`._

## What changed and why

The mutating API endpoints previously accepted **unauthenticated** requests —
anyone could register bots under any operator address, create/repay loans, and
call the paid `/task` endpoint for free (the x402 check was a mock). These are
now gated by an **operator wallet signature** with single-use nonces, and
`/api/sync` is gated by a shared secret.

**If your agent calls these endpoints, it must be updated or it will get 401/402/403.**

## 1. Signed endpoints: `/bots`, `/borrow`, `/repay`, `/task`

Add an `auth` object to the JSON body (for `/task`, base64url-encode that same
object into the `X-Payment-402` header). The operator wallet must sign this exact
message (EIP-191 `personal_sign`):

```
Clawloan API request
action: <register-bot | borrow | repay | repay-with-profit | x402-pay>
address: <operator checksum address>
timestamp: <unix milliseconds, within 5 minutes of server time>
nonce: <unique value per request, e.g. a UUID>
params: <JSON of the action params with keys sorted alphabetically>
```

`params` per action:

| action            | endpoint            | params (sorted keys)                                  |
|-------------------|---------------------|-------------------------------------------------------|
| `register-bot`    | `POST /bots`        | `{ maxBorrowLimit, name, operatorAddress }`           |
| `borrow`          | `POST /borrow`      | `{ amount, botId }`                                    |
| `repay`           | `POST /repay`       | `{ amount, botId }`                                    |
| `repay-with-profit` | `PUT /repay`      | `{ botId, profitAmount, repayAmount }`                |
| `x402-pay`        | `POST /task`        | `{ amount: "100000", botId, endpoint: "/api/task" }`  |

> `maxBorrowLimit` and `profitAmount` use `null` when omitted. The server sorts
> `params` keys before hashing, so client and server must both sort.

### Example (viem / TypeScript)

```ts
import { createWalletClient, custom, getAddress } from "viem";

const address = getAddress(operatorAddress);
const timestamp = Date.now();
const nonce = crypto.randomUUID();
const params = { amount: "5000000", botId };            // sorted keys
const message = [
  "Clawloan API request",
  `action: borrow`,
  `address: ${address}`,
  `timestamp: ${timestamp}`,
  `nonce: ${nonce}`,
  `params: ${JSON.stringify(params)}`,
].join("\n");

const signature = await wallet.signMessage({ account: address, message });

await fetch(`${API}/api/borrow`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ botId, amount: "5000000", auth: { address, timestamp, nonce, signature } }),
});
```

For `POST /task`, send the auth object in the header instead of the body:

```ts
const payment = Buffer.from(JSON.stringify({ address, timestamp, nonce, signature })).toString("base64url");
await fetch(`${API}/api/task`, { method: "POST", headers: { "X-Bot-Id": botId, "X-Payment-402": payment } });
```

### Rejection reasons (401/402/403)
- Missing/invalid signature, or signer ≠ the bot's on-record operator.
- Timestamp more than 5 minutes from server time.
- `(address, nonce)` already used → **replay**. Always use a fresh `nonce`.

## 2. `/api/sync` now requires `CRON_SECRET`

Set `CRON_SECRET` in the server environment (see `.env.example`) and send it:

```
Authorization: Bearer <CRON_SECRET>
```

If `CRON_SECRET` is unset the endpoint returns `503`. Public callers should read
pool data from `GET /api/pools` (read-only, unauthenticated) instead.

## 3. Database change

A new `AuthNonce` table backs replay protection. After deploying:

```bash
npx prisma db push          # creates the AuthNonce table
# then re-run prisma/enable_rls.sql in the Supabase SQL editor (now includes AuthNonce)
```

> Note: x402 currently *authorizes and meters* the charge but does not yet
> settle it on-chain. `Usage.totalOwed` is the amount to collect via an on-chain
> USDC transfer / EIP-3009 facilitator — tracked as a follow-up.
