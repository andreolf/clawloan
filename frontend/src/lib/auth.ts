import { verifyMessage, isAddress, getAddress } from "viem";
import { prisma } from "@/lib/prisma";

// Replay window for signed requests. A signature is only accepted within this
// window of its embedded timestamp. Combined with the single-use nonce store
// below, this both prevents replay AND bounds how long nonces must be retained.
const MAX_SKEW_MS = 5 * 60 * 1000; // 5 minutes

const MAX_NONCE_LEN = 128;

export type AuthEnvelope = {
  address?: string; // claimed signer (must be an operator address)
  timestamp?: number; // ms since epoch, embedded in the signed message
  nonce?: string; // single-use value, embedded in the signed message
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
  timestamp: number,
  nonce: string
): string {
  return [
    "Clawloan API request",
    `action: ${action}`,
    `address: ${getAddress(address)}`,
    `timestamp: ${timestamp}`,
    `nonce: ${nonce}`,
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

  if (
    !auth ||
    !auth.address ||
    !auth.signature ||
    auth.timestamp === undefined ||
    !auth.nonce
  ) {
    return {
      ok: false,
      error: "Missing auth: { address, timestamp, nonce, signature } required",
      status: 401,
    };
  }

  if (!isAddress(auth.address)) {
    return { ok: false, error: "Invalid auth address", status: 401 };
  }

  if (typeof auth.nonce !== "string" || auth.nonce.length === 0 || auth.nonce.length > MAX_NONCE_LEN) {
    return { ok: false, error: "Invalid nonce", status: 401 };
  }

  const ts = Number(auth.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return { ok: false, error: "Stale or invalid timestamp", status: 401 };
  }

  if (expectedAddress && getAddress(expectedAddress) !== getAddress(auth.address)) {
    return { ok: false, error: "Signer not authorized for this resource", status: 403 };
  }

  const signer = getAddress(auth.address);
  const message = buildAuthMessage(action, params, signer, ts, auth.nonce);

  let valid = false;
  try {
    valid = await verifyMessage({
      address: signer,
      message,
      signature: auth.signature,
    });
  } catch {
    valid = false;
  }

  if (!valid) {
    return { ok: false, error: "Invalid signature", status: 401 };
  }

  // Consume the nonce (single-use). Only done AFTER the signature is validated,
  // so an attacker cannot burn a victim's nonces. A unique-constraint violation
  // means this exact (signer, nonce) was already used => replay.
  const consumed = await consumeNonce(signer, auth.nonce);
  if (!consumed) {
    return { ok: false, error: "Nonce already used (replay)", status: 401 };
  }

  return { ok: true, address: signer };
}

async function consumeNonce(address: string, nonce: string): Promise<boolean> {
  try {
    await prisma.authNonce.create({ data: { address, nonce } });
    return true;
  } catch {
    // Unique violation (address, nonce) already exists, or a DB error. Either
    // way we refuse to proceed rather than risk accepting a replay.
    return false;
  }
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
