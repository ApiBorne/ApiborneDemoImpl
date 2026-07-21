/**
 * Contract authentication — two mandatory headers on every kiosk-originated
 * call (contract/openapi.yaml, "Authentification"):
 *
 *   X-Kiosk-Auth-Key   shared authorization key (ApiBorne `brandAuthorizationKey`)
 *   X-Kiosk-Device-Id  unique kiosk device id, provisioned in this editor
 *
 * Validation ORDER is contractual: unknown device → 401 UNKNOWN_DEVICE first,
 * then invalid key → 401 INVALID_AUTH_KEY. Never redirect a 401 (no 302).
 *
 * ApiBorne also sends `X-Kiosk-Office-Id` on every call: the office/licence
 * identity as configured in the ApiBorne integration settings (EasyDoct:
 * "{officeId}!#!{officeVisibleId}"; generic editor: a single free id). A
 * multi-site editor should use IT to select the target office instead of
 * resolving the office from its device table (the kiosk fleet is managed in
 * the ApiBorne admin). This single-site demo ignores it.
 *
 * Two server-to-server operations are exceptions and require ONLY the auth
 * key (they are called by the ApiBorne server, not by a kiosk):
 *   POST /staff/sign-in
 *   PUT  /appointments/{id}/status
 */
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { getSetting, isKnownDevice, registerDevice, setSetting } from "@/server/db/repositories";
import { contractError } from "./errors";

/**
 * Full kiosk auth (device + key). Returns an error response, or null if OK.
 *
 * Two device policies (setting `enforceKnownDevices`):
 *  - STRICT (contract behaviour, what EasyDoct does): an unknown
 *    X-Kiosk-Device-Id is rejected with 401 UNKNOWN_DEVICE — the shared key
 *    identifies the BRAND, the device id identifies WHICH kiosk, and the
 *    editor can revoke a single device.
 *  - LENIENT (demo default): when the kiosk fleet is managed in the ApiBorne
 *    admin, duplicating the device list here is pointless — an unknown device
 *    presenting a VALID auth key is auto-registered on first contact.
 */
export function requireKioskAuth(request: NextRequest): NextResponse | null {
  const deviceId = request.headers.get("x-kiosk-device-id");
  if (!deviceId) {
    return contractError("UNKNOWN_DEVICE", "Missing X-Kiosk-Device-Id header");
  }
  if (!isKnownDevice(deviceId)) {
    if (getSetting("enforceKnownDevices") === "true") {
      return contractError("UNKNOWN_DEVICE", `Unknown kiosk device '${deviceId}'`);
    }
    // Lenient: validate the key FIRST, then remember the device.
    const keyError = requireAuthKey(request);
    if (keyError) {
      return keyError;
    }
    registerDevice(deviceId);
    console.info(`[contract] auto-registered kiosk device '${deviceId}'`);
    return null;
  }
  return requireAuthKey(request);
}

/**
 * Auth-key-only check (staff/sign-in, PUT status — server-to-server calls).
 *
 * The shared key IS the ApiBorne `brandAuthorizationKey`, already defined in
 * the ApiBorne admin (Connectivity page). To avoid copying it by hand, the
 * demo supports TRUST-ON-FIRST-USE: when no key is configured yet, the key
 * presented by the FIRST caller is captured and becomes the expected key
 * (visible/editable in /settings, also reused for the outbound pushes).
 * A production editor should of course provision the key explicitly.
 */
export function requireAuthKey(request: NextRequest): NextResponse | null {
  const authKey = request.headers.get("x-kiosk-auth-key");
  if (!authKey) {
    return contractError("INVALID_AUTH_KEY", "Missing X-Kiosk-Auth-Key header");
  }
  const expected = getSetting("kioskAuthKey");
  if (!expected) {
    setSetting("kioskAuthKey", authKey);
    console.info("[contract] auth key captured on first use (trust-on-first-use)");
    return null;
  }
  if (authKey !== expected) {
    return contractError("INVALID_AUTH_KEY", "Invalid authorization key for this device");
  }
  return null;
}
