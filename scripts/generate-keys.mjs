#!/usr/bin/env node
/**
 * npm run keys:generate — end-to-end encryption key pair for the demo editor.
 *
 * Generates an RSA-4096 key pair (the contract recommends 4096, requires
 * ≥ 2048), then:
 *   - PREPENDS the private key PEM to the `contractEncryptionPrivateKeys`
 *     setting in data/demo.db (newest first — old keys are kept so requests
 *     wrapped with a previous public key still decrypt: rotation);
 *   - prints the PUBLIC key PEM to paste in the ApiBorne admin
 *     (Settings → Connectivity → End-to-end encryption).
 *
 * Deployment order matters: the private key is stored here FIRST, so pasting
 * the public key in the admin afterwards can never produce DECRYPTION_FAILED.
 *
 * Usage: node scripts/generate-keys.mjs [--replace]
 *   --replace  drop the previously stored private keys instead of keeping
 *              them for rotation
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const replace = process.argv.includes("--replace");

const root = process.cwd();
const dbDir = path.join(root, "data");
const dbFile = path.join(dbDir, "demo.db");

console.log("Generating RSA-4096 key pair (a few seconds)…");
const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 4096,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

fs.mkdirSync(dbDir, { recursive: true });
const db = new Database(dbFile);
// Same idempotent schema bootstrap as src/server/db/db.ts — the script must
// work on a fresh checkout where the server never ran.
const schema = fs.readFileSync(path.join(root, "src", "server", "db", "schema.sql"), "utf8");
db.exec(schema);

const row = db
  .prepare("SELECT value FROM settings WHERE key = 'contractEncryptionPrivateKeys'")
  .get();
const existing = replace ? "" : (row?.value ?? "");
const combined = existing ? `${privateKey.trim()}\n${existing.trim()}\n` : privateKey;
db.prepare(
  "INSERT INTO settings (key, value) VALUES ('contractEncryptionPrivateKeys', ?) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
).run(combined);
db.close();

const keyCount = (combined.match(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/g) ?? []).length;
console.log(
  `Private key stored in data/demo.db (${keyCount} key${keyCount > 1 ? "s" : ""} kept for rotation).`,
);
console.log("\nPaste this PUBLIC key in the ApiBorne admin (Connectivity page):\n");
console.log(publicKey);
