# Clawloan / Moltloan — Due Diligence Report

_Date: 2026-08-06 · Scope: smart contracts, frontend API, database, agent flows._

> **Bottom line:** The protocol has **two independent critical fund-loss paths on the live Base contract**, an off-chain API with **no authentication**, and a Supabase database that was **publicly readable/writable** (now fixable — see §4). Recommend **pausing the live LendingPool and halting deposits** until C-1/C-2 are remediated. Do not promote or take new LP deposits in the current state.

---

## 1. Verdict by layer

| Layer | State | Worst issue |
|---|---|---|
| Smart contracts | 🔴 Not safe for funds | C-1 arbitrary-call drain (live), C-2 uncollateralized drain |
| API / backend | 🔴 No auth | Anyone can register bots, borrow, repay, forge x402 |
| Database (Supabase) | 🟠 Was public | RLS disabled — fix provided |
| Read endpoints / frontend | ✅ OK | Read-only, validated |

Build/test: `forge build` succeeds (Solc 0.8.24, OZ v5), 104/104 tests pass — **but** the suite only covers V2 happy paths and misses every finding below. Frontend `tsc` passes.

---

## 2. CRITICAL — smart contracts (money at risk)

### C-1. `borrowAndExecute` = arbitrary call from the pool → full drain (LIVE on Base `0x3Dca…1906`)
`LendingPoolV2.sol:532` runs `(bool success,) = target.call(data);` with **attacker-controlled `target` and `data`**, while the pool is `msg.sender` and custodies all LP USDC. *Verified by reading the function.*

**Exploit (confirmed reachable):**
1. `BotRegistry.registerBot(...)` — permissionless.
2. `PermissionsRegistry.setPermissions(botId, hash, hugeMaxSpend, 0)` — operator self-sets their own limit, so `canSpend`/`hasValidPermissions` pass.
3. `borrowAndExecute(botId, 1e6, USDC, approve(attacker, type(uint256).max))` → the pool calls `USDC.approve(attacker, max)` at line 532. Function completes normally (pulls back ~1.001 USDC).
4. Separate tx: `USDC.transferFrom(pool, attacker, poolBalance)` → **entire pool drained.**

`nonReentrant` does not help — theft is via a legitimate outbound call. **Fix:** delete `borrowAndExecute`, or hard-forbid `target == address(usdc)` + allowlist targets. Because it's deployed: **pause + migrate**, don't hot-patch.

### C-2. Uncollateralized borrow with self-set limits → borrow-and-default drain
Loans have **no collateral**; the only cap is `PermissionsRegistry.maxSpend`, set by the borrower on their own bot.
- **V3 (`LendingPoolV3.sol:260`)** is worse than V2: it **dropped the `canSpend` check and the `maxBorrowPerBlock` rate limit** (grep-confirmed absent). With default config (`enforceCreditLimits=false`, `requireVerification=false`, `minBotAge=0`, `require8004Attestation=false`) a fresh bot passes only `hasValidPermissions` and can `borrow(available)` — the **whole pool** — in one tx, then never repay.
- **Bonus V3 gap (not in original audit):** `borrow` never checks `botRegistry.isOperator(botId, msg.sender)` (V2 did). No caller authorization at all.

**Fix:** require real collateral or a **protocol-derived** credit limit (never self-set); re-add `canSpend`, a per-block cap, and an `isOperator` check to V3; enable `enforceCreditLimits` + `minBotAge` by default.

---

## 3. HIGH / MEDIUM — smart contracts

- **H-1. Liquidation recovers nothing.** V3 `liquidate` (359–389) makes the *liquidator* pay the defaulter's debt for a ≤5% bonus paid from `reserves` — economically irrational, so no one liquidates; expired loans lock liquidity forever. V2 `liquidate` (line 577) needs the *defaulter's* approval, so it reverts. Either way LPs eat 100% of defaults. **Fix:** seize collateral on default; fund liquidator reward from it.
- **H-2. Defaulting *raises* credit score in V2.** `liquidate` calls `creditScoring.recordRepayment(botId, 0)` (`LendingPoolV2.sol:600`) — the comment says "hurts score" but the code increments `successfulRepayments`/streak and can upgrade tier. *Verified.* Attacker farms tier upgrades by borrow→default. **Fix:** call `recordDefault(botId, principal)` (as V3 does at :385).
- **M-1. V3 UUPS uses non-upgradeable `ReentrancyGuard`** (`LendingPoolV3.sol:10/26`) — sequential storage slot in a proxy, no `__gap`. Works today but any inheritance-order change corrupts pool state on upgrade. **Fix:** `ReentrancyGuardUpgradeable` + `__ReentrancyGuard_init()`.
- **M-2. V3 `liquidate` loses interest** — pulls `principal+interest` but only credits `principal`; interest becomes stranded, unwithdrawable USDC. **Fix:** split interest into reserves/deposits as `repay()` does.
- **M-3. `StakingModule` (not deployed)** — `emergencyWithdraw` lets owner drain reward USDC; `slash()` doesn't decrement `totalStaked`, bricking later `unstake`. Fix before any deploy.

**Positive:** V3 `_authorizeUpgrade` is `onlyOwner`; impl constructor calls `_disableInitializers()`; proxy initialized atomically (no front-run); `SafeERC20` everywhere; 0.8.24 checked math; share value uses internal accounting (mitigates first-depositor inflation).

---

## 4. Backend / API / Database

- **🔴 No authentication anywhere.** No middleware, no signature check, no API key. `POST /api/bots` (self-set `operatorAddress` + `maxBorrowLimit`), `/api/borrow`, `/api/repay`, `/api/task` are world-open. **Fix:** SIWE / wallet-signature auth verifying control of `operatorAddress`.
- **🔴 x402 payment is mocked.** `/api/task` `validateX402Payment` passes on *any* non-empty `X-Payment-402` header (labeled "Mock"). Free access to a paid endpoint. **Fix:** real settlement verification.
- **🟠 Off-chain ledger disconnected from funds.** API borrow/repay only mutate Prisma rows and never touch the contract or reconcile with it; `/api/repay` PUT trusts attacker-supplied `profitAmount`. Decide whether the DB is a cache of chain truth or drop the write endpoints.
- **🟠 `/api/sync` has no `CRON_SECRET`** — anyone can trigger it.
- **🟠 Supabase RLS disabled** (the advisory email). Public PostgREST API exposed all tables. **Fix provided:** run [frontend/prisma/enable_rls.sql](frontend/prisma/enable_rls.sql) in the Supabase SQL Editor; re-run after any `prisma db push`.
- **✅ Clean:** `.env` gitignored/untracked; no secrets in `NEXT_PUBLIC`; read endpoints validated & read-only; uncommitted diff (removing `ClawloanToken`/`StakingModule` tests) is intentional and consistent with the "No Token" stance.

---

## 5. Prioritized remediation order

1. **Now (ACTION REQUIRED — not code):** Pause the live LendingPool V2 (`0x3Dca…1906`) and stop advertising deposits. C-1 is exploitable on the immutable deployed contract; source fixes do not protect it.
2. **Now (ACTION REQUIRED — not code):** Run `enable_rls.sql` in the Supabase SQL editor.
3. **Before any redeploy / mainnet with real value:** independent external audit — the internal suite passed 104/104 while missing two criticals.

### Remediation status (this branch)

| Finding | Status |
|---|---|
| C-1 arbitrary-call drain | ✅ `borrowAndExecute` removed from V2 source (live contract still needs pause+migrate) |
| C-2 uncollateralized/self-set drain | ✅ V3 `borrow` now enforces `isOperator`, `canSpend`, per-block rate limit |
| H-1 liquidation recovers nothing | ✅ V3 `liquidate` rewritten as bad-debt write-off (loss realized, liquidity unlocked) |
| H-2 default raises credit score | ✅ V2 liquidate now calls `recordDefault` instead of `recordRepayment(0)` |
| M-1 non-upgradeable ReentrancyGuard | ✅ replaced with upgrade-safe storage-based guard + `__gap` |
| M-2 V3 liquidate strands interest | ✅ resolved by the write-off model (nothing pulled in) |
| API no auth | ✅ EIP-191 operator-signature auth on `/bots`,`/borrow`,`/repay` |
| x402 mocked | ✅ `/task` now requires a signed payment authorization (settlement still on-chain TODO) |
| `/api/sync` unprotected | ✅ gated behind `CRON_SECRET` |
| Supabase RLS | ⏳ SQL provided — **must be run in the dashboard** |
| Off-chain ledger disconnected from funds | ⚠️ architectural — still open (design decision) |
| Collateral for loans | ✅ operator-bond + reserve-backed credit lines (solvency invariant `totalUnbacked ≤ reserves`); see [DESIGN_bond_underwriting.md](docs/DESIGN_bond_underwriting.md) |

Tests: 123 contract tests passing (incl. `LendingPoolV3Security.t.sol` — C-2 gates, bond limits, solvency invariant, bond+reserve liquidation recovery, unbonding); frontend type-checks clean; auth signature round-trip verified.
