/**
 * End-to-end encryption — reference implementation of the contract's optional
 * "Chiffrement de bout en bout" section (contract/openapi.yaml).
 *
 * Protocol v1, in one paragraph: per attempt (retries included) the kiosk
 * generates a fresh AES-256 session key + 96-bit IV, encrypts the JSON body
 * with AES-256-GCM (128-bit auth tag CONCATENATED after the ciphertext — the
 * WebCrypto convention), wraps the session key with the establishment's RSA
 * public key (RSA-OAEP-SHA256) and sends:
 *
 *   X-Kiosk-Encryption: v1
 *   X-Kiosk-Encryption-Key: <wrapped session key, base64>
 *   body: { "encrypted": { "v": 1, "iv": "<b64>", "data": "<b64 ct+tag>" } }
 *
 * The editor (this file) unwraps the session key with its PRIVATE key(s),
 * decrypts the request, and seals 2xx JSON responses with the SAME session
 * key and a FRESH IV. 204 has no body; 4xx/5xx errors stay in CLEAR (retry
 * policy + diagnostics — never put patient data in error messages).
 *
 * Key rotation: several private keys may be configured (concatenated PEMs in
 * the `contractEncryptionPrivateKeys` setting, newest first) — each is tried
 * at unwrap time. Deploy the new private key HERE before pasting the new
 * public key in the ApiBorne admin.
 *
 * Scope: the 10 kiosk-originated communication routes only. NOT the /config/*
 * referentials, NOT staff/sign-in, NOT PUT /appointments/{id}/status (those
 * are called by the ApiBorne server, which legitimately reads the responses).
 */
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSetting } from "@/server/db/repositories";
import { requireKioskAuth } from "./auth";
import { CORS_HEADERS } from "./cors";
import { contractError } from "./errors";

export const ENCRYPTION_VERSION = "v1";
const AES_KEY_LENGTH = 32;
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

/** Internal marker: any failure that must surface as 400 DECRYPTION_FAILED. */
class DecryptionFailure extends Error {}

interface EncryptedEnvelope {
  v: number;
  iv: string;
  data: string;
}

// ---------------------------------------------------------------------------
// Private keys (rotation-aware)
// ---------------------------------------------------------------------------

let cachedPemText: string | null = null;
let cachedKeys: crypto.KeyObject[] = [];

/**
 * Private keys from the `contractEncryptionPrivateKeys` setting: one or more
 * concatenated PEM blocks (rotation — newest first). Parsed once per distinct
 * setting value.
 */
export function getPrivateKeys(): crypto.KeyObject[] {
  const pemText = getSetting("contractEncryptionPrivateKeys") ?? "";
  if (pemText === cachedPemText) {
    return cachedKeys;
  }
  const blocks =
    pemText.match(
      /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    ) ?? [];
  const keys: crypto.KeyObject[] = [];
  for (const block of blocks) {
    try {
      keys.push(crypto.createPrivateKey(block));
    } catch {
      console.warn(
        "[contract crypto] ignoring an unparsable private key PEM block",
      );
    }
  }
  cachedPemText = pemText;
  cachedKeys = keys;
  return keys;
}

/** At least one private key is configured → the editor accepts encrypted calls. */
export function isEncryptionConfigured(): boolean {
  return getPrivateKeys().length > 0;
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** Unwrap the AES session key (RSA-OAEP-SHA256), trying every configured private key. */
function unwrapSessionKey(wrappedKeyBase64: string): Buffer {
  const keys = getPrivateKeys();
  if (keys.length === 0) {
    throw new DecryptionFailure(
      "no encryption private key is configured on this editor",
    );
  }
  const wrapped = Buffer.from(wrappedKeyBase64, "base64");
  for (const key of keys) {
    try {
      const sessionKey = crypto.privateDecrypt(
        {
          key,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        wrapped,
      );
      if (sessionKey.length === AES_KEY_LENGTH) {
        return sessionKey;
      }
    } catch {
      // OAEP fails fast on the wrong key — try the next one (rotation).
    }
  }
  throw new DecryptionFailure(
    "session key does not unwrap with any configured private key",
  );
}

/** AES-256-GCM decrypt of `{ v, iv, data }` (tag concatenated after the ciphertext). */
function decryptEnvelope(
  sessionKey: Buffer,
  envelope: EncryptedEnvelope,
): string {
  if (
    envelope.v !== 1 ||
    typeof envelope.iv !== "string" ||
    typeof envelope.data !== "string"
  ) {
    throw new DecryptionFailure("malformed encrypted envelope");
  }
  const iv = Buffer.from(envelope.iv, "base64");
  const payload = Buffer.from(envelope.data, "base64");
  if (iv.length !== GCM_IV_LENGTH || payload.length < GCM_TAG_LENGTH) {
    throw new DecryptionFailure("malformed encrypted envelope (iv/data sizes)");
  }
  const ciphertext = payload.subarray(0, payload.length - GCM_TAG_LENGTH);
  const authTag = payload.subarray(payload.length - GCM_TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey, iv);
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new DecryptionFailure("authentication tag mismatch");
  }
}

/**
 * Seal a 2xx JSON payload: SAME session key as the request, FRESH IV (never
 * reuse the request IV — GCM is broken by IV reuse under one key).
 */
export function sealResponse(
  sessionKey: Buffer,
  payload: unknown,
  status = 200,
): NextResponse {
  const iv = crypto.randomBytes(GCM_IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const data = Buffer.concat([ciphertext, cipher.getAuthTag()]).toString(
    "base64",
  );
  return NextResponse.json(
    { encrypted: { v: 1, iv: iv.toString("base64"), data } },
    {
      status,
      headers: { ...CORS_HEADERS, "X-Kiosk-Encryption": ENCRYPTION_VERSION },
    },
  );
}

/**
 * Open an encrypted request: unwrap the session key from the headers and, when
 * the request has a body, decrypt the `{ encrypted }` envelope into a clone of
 * the request carrying the CLEAR body (so handlers keep calling request.json()
 * unchanged). Throws DecryptionFailure on any crypto problem.
 */
async function openEnvelope(
  request: NextRequest,
  wrappedKeyBase64: string,
): Promise<{ sessionKey: Buffer; clearRequest: NextRequest }> {
  const sessionKey = unwrapSessionKey(wrappedKeyBase64);
  const rawBody = await request.text();
  if (rawBody.trim().length === 0) {
    // GET/DELETE: headers only — the session key is there to seal the response.
    return { sessionKey, clearRequest: request };
  }
  let parsed: { encrypted?: EncryptedEnvelope } | null = null;
  try {
    parsed = JSON.parse(rawBody) as { encrypted?: EncryptedEnvelope };
  } catch {
    throw new DecryptionFailure("body is not JSON");
  }
  if (!parsed?.encrypted) {
    // Anti-downgrade: encryption headers + clear body is a protocol violation.
    throw new DecryptionFailure(
      "encryption headers present but body is not an encrypted envelope",
    );
  }
  const clearBody = decryptEnvelope(sessionKey, parsed.encrypted);
  const clearRequest = new NextRequest(request.url, {
    method: request.method,
    headers: request.headers,
    body: clearBody,
  });
  return { sessionKey, clearRequest };
}

// ---------------------------------------------------------------------------
// Route wrapper
// ---------------------------------------------------------------------------

/**
 * Wraps a COMMUNICATION route handler with the end-to-end encryption protocol.
 *
 *  - No encryption headers → 400 ENCRYPTION_REQUIRED as soon as private keys
 *    are configured (encryption is MANDATORY for any active ApiBorne
 *    integration — no opt-out); pass through in clear only while no key is
 *    provisioned yet.
 *  - Encryption headers present → auth FIRST (never act as a decryption
 *    oracle for unauthenticated callers), then decrypt the request, run the
 *    handler on the clear body, and re-seal 2xx JSON responses (same session
 *    key, fresh IV). 204 and 4xx/5xx pass through IN CLEAR.
 *
 * Compose it OUTSIDE withErrorBoundary:
 *   export const POST = withErrorBoundary(withContractCrypto(async (request) => …));
 */
export function withContractCrypto<Args extends unknown[]>(
  handler: (
    request: NextRequest,
    ...args: Args
  ) => Promise<NextResponse> | NextResponse,
): (request: NextRequest, ...args: Args) => Promise<NextResponse> {
  return async (request: NextRequest, ...args: Args) => {
    const version = request.headers.get("x-kiosk-encryption");
    const wrappedKey = request.headers.get("x-kiosk-encryption-key");

    if (!version && !wrappedKey) {
      // Strict mode is MANDATORY: as soon as private keys are configured,
      // clear-text communication calls are rejected — encryption is required
      // for any active ApiBorne integration, there is no opt-out toggle.
      if (isEncryptionConfigured()) {
        return contractError(
          "ENCRYPTION_REQUIRED",
          "This editor requires end-to-end encryption (missing X-Kiosk-Encryption headers)",
        );
      }
      return handler(request, ...args);
    }

    const authError = requireKioskAuth(request);
    if (authError) return authError;

    if (version !== ENCRYPTION_VERSION || !wrappedKey) {
      return contractError(
        "DECRYPTION_FAILED",
        `Unsupported encryption headers (expected X-Kiosk-Encryption: ${ENCRYPTION_VERSION} with X-Kiosk-Encryption-Key)`,
      );
    }

    let sessionKey: Buffer;
    let clearRequest: NextRequest;
    try {
      ({ sessionKey, clearRequest } = await openEnvelope(request, wrappedKey));
    } catch (error) {
      const message =
        error instanceof DecryptionFailure
          ? error.message
          : "decryption failed";
      // NO patient data ever goes into error messages; errors stay in clear.
      return contractError("DECRYPTION_FAILED", message);
    }

    const response = await handler(clearRequest, ...args);
    if (!response.ok || response.status === 204) {
      return response; // errors + no-content stay in clear
    }
    const payload = (await response
      .clone()
      .json()
      .catch(() => null)) as unknown;
    if (payload === null) {
      return response; // non-JSON 2xx (does not happen in this demo)
    }
    return sealResponse(sessionKey, payload, response.status);
  };
}
