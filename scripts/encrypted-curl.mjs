#!/usr/bin/env node
/**
 * encrypted-curl — test oracle for the contract's end-to-end encryption.
 *
 * Does exactly what the kiosk does: generates a fresh AES-256 session key and
 * 96-bit IV, encrypts the JSON body (AES-256-GCM, tag concatenated — the
 * WebCrypto convention), wraps the session key with the editor's PUBLIC key
 * (RSA-OAEP-SHA256), sends the request, then decrypts the `{ encrypted }`
 * response with the same session key.
 *
 * Use it to validate ANY contract implementation (this demo, EasyDoct C#…):
 * if encrypted-curl round-trips, the kiosk will too.
 *
 * Usage:
 *   node scripts/encrypted-curl.mjs [METHOD] PATH [BODY|@file] [options]
 *
 *   METHOD  GET|POST|PUT|PATCH|DELETE (default: GET, or POST when a body is given)
 *   PATH    contract path, e.g. /patients/identify
 *   BODY    inline JSON, or @file.json
 *
 * Options:
 *   --url <base>        default http://localhost:3020/api/apiborneIntegrationService/v1
 *   --public-key <pem>  public key FILE; default: derived from the newest
 *                       private key stored in data/demo.db (keys:generate)
 *   --auth-key <key>    X-Kiosk-Auth-Key (default: kioskAuthKey setting, else demo-auth-key)
 *   --device <id>       X-Kiosk-Device-Id (default DEMO-KIOSK-1)
 *   --plain             send in CLEAR (no encryption headers) — compat check
 *   --corrupt-tag       flip a bit in the auth tag → editor must answer 400 DECRYPTION_FAILED
 *
 * Examples:
 *   node scripts/encrypted-curl.mjs POST /patients/identify '{"criteria":{"lastName":"MARTIN"}}'
 *   node scripts/encrypted-curl.mjs GET '/appointments/1~abc'
 *   node scripts/encrypted-curl.mjs POST '/appointments/1~abc/documents' @upload.json --corrupt-tag
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const options = { plain: false, corruptTag: false };
const positional = [];
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--url") options.url = args[++i];
  else if (arg === "--public-key") options.publicKeyFile = args[++i];
  else if (arg === "--auth-key") options.authKey = args[++i];
  else if (arg === "--device") options.device = args[++i];
  else if (arg === "--plain") options.plain = true;
  else if (arg === "--corrupt-tag") options.corruptTag = true;
  else positional.push(arg);
}

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
let method = null;
if (positional[0] && METHODS.has(positional[0].toUpperCase())) {
  method = positional.shift().toUpperCase();
}
const requestPath = positional.shift();
if (!requestPath) {
  console.error("Usage: node scripts/encrypted-curl.mjs [METHOD] PATH [BODY|@file] [options]");
  process.exit(2);
}
let bodyText = positional.shift() ?? null;
if (bodyText?.startsWith("@")) {
  bodyText = fs.readFileSync(bodyText.slice(1), "utf8");
}
method = method ?? (bodyText ? "POST" : "GET");

// ---------------------------------------------------------------------------
// Key + auth material (defaults read from the demo database)
// ---------------------------------------------------------------------------

async function readDemoSettings() {
  const dbFile = path.join(process.cwd(), "data", "demo.db");
  if (!fs.existsSync(dbFile)) return {};
  try {
    // Lazy import: better-sqlite3 is only needed for the defaults.
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(dbFile, { readonly: true });
    const rows = db.prepare("SELECT key, value FROM settings").all();
    db.close();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

const settings = await readDemoSettings();

let publicKey;
if (options.publicKeyFile) {
  publicKey = crypto.createPublicKey(fs.readFileSync(options.publicKeyFile, "utf8"));
} else if (!options.plain) {
  const pems = settings.contractEncryptionPrivateKeys ?? "";
  const firstPrivate = pems.match(
    /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/,
  )?.[0];
  if (!firstPrivate) {
    console.error(
      "No public key: run `npm run keys:generate` first, or pass --public-key <pem file>.",
    );
    process.exit(2);
  }
  publicKey = crypto.createPublicKey(crypto.createPrivateKey(firstPrivate));
}

const baseUrl = options.url ?? "http://localhost:3020/api/apiborneIntegrationService/v1";
const authKey = options.authKey ?? settings.kioskAuthKey ?? "demo-auth-key";
const deviceId = options.device ?? "DEMO-KIOSK-1";

// ---------------------------------------------------------------------------
// Encrypt → call → decrypt
// ---------------------------------------------------------------------------

const headers = {
  "X-Kiosk-Auth-Key": authKey,
  "X-Kiosk-Device-Id": deviceId,
  "Content-Type": "application/json",
};

let sessionKey = null;
let requestBody = bodyText;
if (!options.plain) {
  sessionKey = crypto.randomBytes(32);
  const wrappedKey = crypto.publicEncrypt(
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
    sessionKey,
  );
  headers["X-Kiosk-Encryption"] = "v1";
  headers["X-Kiosk-Encryption-Key"] = wrappedKey.toString("base64");

  if (bodyText) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(bodyText, "utf8"), cipher.final()]);
    const payload = Buffer.concat([ciphertext, cipher.getAuthTag()]);
    if (options.corruptTag) {
      payload[payload.length - 1] ^= 0x01; // flip one tag bit → DECRYPTION_FAILED expected
    }
    requestBody = JSON.stringify({
      encrypted: { v: 1, iv: iv.toString("base64"), data: payload.toString("base64") },
    });
  }
}

const url = baseUrl.replace(/\/$/, "") + requestPath;
console.error(`> ${method} ${url} ${options.plain ? "(clear)" : "(encrypted v1)"}`);
const response = await fetch(url, {
  method,
  headers,
  body: requestBody ?? undefined,
});

const responseText = await response.text();
console.error(`< HTTP ${response.status} X-Kiosk-Encryption: ${response.headers.get("x-kiosk-encryption") ?? "-"}`);

if (!responseText) {
  console.error("< (no body)");
  process.exit(response.ok ? 0 : 1);
}

let output = responseText;
try {
  const json = JSON.parse(responseText);
  if (json?.encrypted && sessionKey) {
    const iv = Buffer.from(json.encrypted.iv, "base64");
    const payload = Buffer.from(json.encrypted.data, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey, iv);
    decipher.setAuthTag(payload.subarray(payload.length - 16));
    const clear = Buffer.concat([
      decipher.update(payload.subarray(0, payload.length - 16)),
      decipher.final(),
    ]).toString("utf8");
    console.error("< body was encrypted — decrypted with the session key:");
    output = JSON.stringify(JSON.parse(clear), null, 2);
  } else {
    output = JSON.stringify(json, null, 2);
  }
} catch {
  // non-JSON body (or decryption failure): print as-is below
}
console.log(output);
process.exit(response.ok ? 0 : 1);
