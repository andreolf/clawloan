import { verifyMessage, isAddress, getAddress } from "viem";

// Replay window for signed requests. A signature is only accepted within this
// window of its embedded timestamp. This bounds replay without a nonce store;
// for stronger guarantees add a persisted nonce table (see NOTE below).
const MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes

// NOTE (follow-up): timestamp-windowing allows replay within MAX_SKEW_MS. For
// full protection, persist a per-address nonce (e.g. a Prisma `Nonce` row) and
// require each signature to carry an unused nonce. Tracked as a hardening TODO.

export type AuthEnvelope = {
  address?: string; // claimed signer (must be an operator address)
  timestamp?: number; // ms since epoch, embedded in the signed message
  signature?: `0x${string}`;
};

export type AuthResult =
  | { ok: true; address: `0x${string}` }
  | { ok: false; error: string; status: number };

/**
 * Canonical, human-readable message the client must sign (EIP-191 personal_sign).
 * Binding action + params + address + timestamp prevents a signature for one
 * action being replayed against another.
 */
export function buildAuthMessage(
  action: string,
  params: Record<string, unknown>,
  address: string,
  timestamp: number
): string {
  return [
    "Clawloan API request",
    `action: ${action}`,
    `address: ${getAddress(address)}`,
    `timestamp: ${timestamp}`,
    `params: ${stableStringify(params)}`,
  ].join("\n");
}

/**
 * Verify a signed API request. Returns the recovered/authorized address on
 * success, or a structured error with an HTTP status on failure.
 *
 * @param expectedAddress if set, the signer MUST equal this address (e.g. the
 *        bot's on-record operator). Prevents acting on another operator's behalf.
 */
export async function verifyAuth(opts: {
  action: string;
  params: Record<string, unknown>;
  auth: AuthEnvelope | undefined;
  expectedAddress?: string;
}): Promise<AuthResult> {
  const { action, params, auth, expectedAddress } = opts;

  if (!auth || !auth.address || !auth.signature || auth.timestamp === undefined) {
    return {
      ok: false,
      error: "Missing auth: { address, timestamp, signature } required",
      status: 401,
    };
  }

  if (!isAddress(auth.address)) {
    return { ok: false, error: "Invalid auth address", status: 401 };
  }

  const ts = Number(auth.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return { ok: false, error: "Stale or invalid timestamp", status: 401 };
  }

  if (expectedAddress && getAddress(expectedAddress) !== getAddress(auth.address)) {
    return { ok: false, error: "Signer not authorized for this resource", status: 403 };
  }

  const message = buildAuthMessage(action, params, auth.address, ts);

  let valid = false;
  try {
    valid = await verifyMessage({
      address: getAddress(auth.address),
      message,
      signature: auth.signature,
    });
  } catch {
    valid = false;
  }

  if (!valid) {
    return { ok: false, error: "Invalid signature", status: 401 };
  }

  return { ok: true, address: getAddress(auth.address) };
}

/** Deterministic JSON stringify (sorted keys) so client and server agree. */
function stableStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  return JSON.stringify(
    keys.reduce((acc, k) => {
      acc[k] = obj[k];
      return acc;
    }, {} as Record<string, unknown>)
  );
}
