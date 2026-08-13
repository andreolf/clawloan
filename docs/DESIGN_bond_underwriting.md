# Design: Operator Bonds + Reserve-Backed Credit Lines

_Status: **IMPLEMENTED** in `LendingPoolV3` (UUPS, not yet deployed) with tests in `LendingPoolV3Security.t.sol`._

**Decisions locked:** credit line = `CreditScoring.getRecommendedLimit` flat-capped at `maxCreditLine` (default 100 USDC); interest on default is forgone (principal-only solvency); `bondsRequired` is an owner toggle defaulting to **on** at launch (grace-window off-switch for upgrading a live pool). See the invariant, integration, and test-plan sections below — all implemented.

## 1. Goal

Keep loans **undercollateralized to the borrower** (the product thesis) while making the pool **provably solvent** — a self-registered anon must not be able to drain LP funds. This addresses audit finding **C-2 / H-1** at the design level; the `isOperator`/`canSpend`/rate-limit fixes already merged are damage-bounding, not solvency.

We give up a little **capital efficiency** (operators post a bond) and, for the "extra" credit beyond the bond, a little **permissionlessness** (that portion is gated by credit tier / attestation). Anonymity is preserved for bonded borrowing.

## 2. Model

Everything is denominated in USDC (the pool asset), so slashing and coverage are pure accounting moves — no external transfers, no second token.

Per **operator** address `op`:

| Symbol | Meaning |
|---|---|
| `stake[op]` | USDC the operator has bonded (locked) |
| `debt[op]` | Σ active loan principal across all of `op`'s bots |
| `creditLine[op]` | undercollateralized allowance from credit tier; `0` for new/unattested operators |

**Borrow limit (per operator):**
```
debt[op] + amount  ≤  stake[op] + creditLine[op]
```
So an operator can always borrow up to their bond (1×), plus a credit-tier bonus.

**Unbacked exposure** — the part of an operator's debt their own bond does *not* cover:
```
unbacked[op] = max(0, debt[op] - stake[op])
```

**Global solvency invariant** (maintained incrementally as `totalUnbacked`):
```
Σ unbacked[op]  ≤  reserves
```

### Why this is solvent

On default of principal `P` by `op`, liquidation does:
1. `slash = min(stake[op], P)` → move from `stake[op]` into LP deposits (full recovery of the bonded portion).
2. `residual = P − slash` → covered from `reserves` (the invariant guarantees reserves ≥ Σ residual system-wide).
3. `totalBorrows −= P`, `debt[op] −= P`, update `totalUnbacked`, `creditScoring.recordDefault(op's bot, P)`.

Result: **LP principal is never lost.** The bonded portion is recovered by slashing; the unbacked portion is pre-funded by reserves, and the invariant ensures reserves can never be over-committed. Unpaid *interest* on a defaulted loan is forgone yield (not a principal loss) — an accepted, documented tradeoff.

> Contrast with today: liquidation recovers nothing and the loss is socialized to LPs (the write-off model). Bonds + reserve-backing turn that socialized loss into a covered loss.

## 3. Where it lives

Recommend **embedding the bond accounting in `LendingPoolV3`** (append-only storage; V3 is not yet deployed, so layout is free) rather than a separate vault. Rationale: staked USDC lives in the same contract, so slash/cover are accounting moves with no cross-contract trust or re-entrancy surface. A standalone `BondVault` is the alternative if you want bonds reusable across pools — more moving parts, deferred.

### New storage (append after the rate-limit block, before `__gap`; shrink `__gap`)
```solidity
mapping(address => uint256) public stake;         // bonded USDC per operator
mapping(address => uint256) public operatorDebt;  // Σ active principal per operator
mapping(address => uint256) public unbondAt;      // earliest unstake time
uint256 public totalStaked;                       // Σ stake (segregated from totalDeposits)
uint256 public totalUnbacked;                      // Σ max(0, debt-stake) — the invariant LHS
uint256 public maxCreditLine;                      // cap on per-operator credit bonus
uint256 public unbondingPeriod;                    // e.g. 7 days
```
`stake` USDC is **segregated** from `totalDeposits`: borrowable liquidity stays `totalDeposits − totalBorrows`. Contract USDC balance = `totalDeposits + totalStaked + reserves − totalBorrows`.

### New external functions
```solidity
function bond(uint256 amount) external;            // pull USDC, stake[msg.sender]+=amount, totalStaked+=amount
function requestUnbond() external;                 // start unbonding timer (unbondAt = now + unbondingPeriod)
function unbond(uint256 amount) external;          // after timer AND if invariant + limit still hold
// admin
function setMaxCreditLine(uint256) external onlyOwner;
function setUnbondingPeriod(uint256) external onlyOwner;
```

### `creditLine[op]`
Sourced from the existing `CreditScoring.getRecommendedLimit(botId)`, capped at `maxCreditLine`, and **`0` unless the operator passes the Sybil gate** (`require8004Attestation` / `minBotAge` already in V3). This is the "give up a little permissionlessness" lever: unbonded credit only for identities that cost something to mint.

## 4. Integration points (pseudocode)

### `borrow(botId, amount)` — add after existing gates, before `totalBorrows += amount`
```solidity
address op = msg.sender; // already required to be the bot operator
uint256 limit = stake[op] + _creditLine(op);
require(operatorDebt[op] + amount <= limit, "ExceedsBondedLimit");

// maintain the global invariant
uint256 newUnbacked = _unbacked(operatorDebt[op] + amount, stake[op]);
uint256 delta = newUnbacked - _unbacked(operatorDebt[op], stake[op]);
require(totalUnbacked + delta <= reserves, "ExceedsSystemCredit");

operatorDebt[op] += amount;
totalUnbacked   += delta;
```

### `repay(botId)` — after clearing the loan
```solidity
operatorDebt[op] -= principal;
totalUnbacked = totalUnbacked - _unbackedDelta(...); // recompute
```

### `liquidate(botId)` — replace the write-off body with bond+reserve coverage
```solidity
uint256 slash = stake[op] >= principal ? principal : stake[op];
stake[op]   -= slash;  totalStaked -= slash;  totalDeposits += slash; // LP recovery
uint256 residual = principal - slash;
if (residual > 0) { reserves -= residual; totalDeposits += residual; } // pre-funded by invariant
totalBorrows    -= principal;
operatorDebt[op] -= principal;
totalUnbacked = totalUnbacked - _unbackedDelta(...);
creditScoring.recordDefault(botId, principal);
```

### `withdrawReserves(amount)` — tighten the guard
```solidity
require(amount <= reserves - totalUnbacked, "Would break solvency invariant");
```
(Reserves committed as credit backing cannot be withdrawn by the owner.)

## 5. Parameters (initial suggestions)
| Param | Value | Note |
|---|---|---|
| `maxCreditLine` | small (e.g. 100 USDC) initially | the only truly-unbacked exposure per op; scale with confidence |
| `unbondingPeriod` | 7 days | prevents stake-borrow-unstake-default |
| `require8004Attestation` | true | credit line = 0 without it |
| per-block rate limit | (already merged) | orthogonal DoS/drain bound |

## 6. Edge cases & risks
- **Interest on default** is forgone (not covered by bond). Accepted; optionally add a small interest buffer to `limit`.
- **Unbonding griefing / run-before-default:** `unbondingPeriod` + the check that `unbond` cannot drop `stake[op]` below what's needed for `operatorDebt[op]` and the invariant.
- **Reserve depletion ordering:** invariant is enforced at borrow time and reserves can only *grow* from interest or shrink via the tightened `withdrawReserves`; liquidation spends reserves it already reserved, so it can't go negative.
- **Multiple bots per operator:** exposure is tracked at the **operator** level (`operatorDebt[op]`), so an operator can't multiply their limit by registering many bots.
- **Stake ≠ borrowable liquidity:** must keep `totalStaked`/`reserves` segregated from `totalDeposits` in every path (`getUtilization`, `withdraw`, `sharesToAmount`) — a review checklist item.
- **First-depositor / donation:** unchanged (share value uses internal `totalDeposits`).

## 7. Upgrade / migration
- V3 is UUPS and **not deployed**, so new storage is appended freely (reduce `__gap` by the count added). If a V3 proxy is later deployed and then upgraded to this, `bond` accounting starts at zero and the owner sets `maxCreditLine`/`unbondingPeriod` post-upgrade (initializer won't re-run).
- Backwards behavior: with `maxCreditLine = 0` and no bonds, `borrow` limit is `0` → the pool is effectively frozen until operators bond. Consider a migration window where `creditLine` falls back to `getRecommendedLimit` so existing flows don't hard-break.

## 8. Test plan (Foundry, extend `LendingPoolV3Security.t.sol`)
1. `bond` then `borrow` up to `stake` (1×) succeeds; `+1` over `stake + creditLine` reverts `ExceedsBondedLimit`.
2. Global invariant: with `reserves = R`, total unbacked borrowing across operators cannot exceed `R` (`ExceedsSystemCredit`).
3. **Solvency property test:** N operators bond, borrow, and ALL default → assert `totalDeposits` (LP principal) is fully preserved; only interest is lost.
4. Liquidation slashes the defaulter's `stake` first, then reserves; `stake` of *non-defaulting* operators is untouched.
5. `operatorDebt` aggregates across multiple bots of one operator (no limit multiplication).
6. `requestUnbond` + `unbond` blocked before `unbondingPeriod`; blocked if it would violate limit/invariant; allowed otherwise.
7. `withdrawReserves` cannot drop `reserves` below `totalUnbacked`.
8. `creditLine = 0` without attestation; nonzero with it.
9. Invariant/fuzz: `totalUnbacked <= reserves` holds after any sequence of bond/borrow/repay/liquidate/unbond (add to `Invariant.t.sol`).

## 9. Open questions for you
- **Credit line source:** reuse `CreditScoring.getRecommendedLimit`, or a separate underwriter-set value?
- **Leverage appetite:** is `maxCreditLine` a flat cap, or a multiple of stake (e.g. up to 2× stake for gold-tier)? A multiple is more capital-efficient but raises the reserve requirement.
- **Interest buffer:** cover interest with stake too, or accept forgone-yield-on-default?
- **Migration window:** hard cutover to bonds, or a grace period where old `getRecommendedLimit` still applies?
