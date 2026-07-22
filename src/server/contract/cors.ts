/**
 * CORS — mandatory for the contract: the ApiBorne kiosk is a BROWSER app that
 * calls the editor cross-origin during the patient journey. The editor must:
 *   - answer OPTIONS preflights,
 *   - allow GET/POST/PUT/PATCH/DELETE,
 *   - allow the Content-Type, X-Kiosk-Auth-Key, X-Kiosk-Device-Id,
 *     X-Kiosk-Office-Id, X-Kiosk-Encryption and X-Kiosk-Encryption-Key
 *     headers (the last two carry the optional end-to-end encryption),
 *   - expose X-Kiosk-Encryption so the kiosk can read it on responses.
 *
 * A demo allows any origin; a production editor should restrict
 * Access-Control-Allow-Origin to the known kiosk origins.
 */
import { NextResponse } from "next/server";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Kiosk-Auth-Key, X-Kiosk-Device-Id, X-Kiosk-Office-Id, X-Kiosk-Encryption, X-Kiosk-Encryption-Key",
  "Access-Control-Expose-Headers": "X-Kiosk-Encryption",
  "Access-Control-Max-Age": "86400",
};

/**
 * Shared OPTIONS handler — re-export it from every contract route file:
 *   export { corsOptions as OPTIONS } from "@/server/contract/cors";
 */
export function corsOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
