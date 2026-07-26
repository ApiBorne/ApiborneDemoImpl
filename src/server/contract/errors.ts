/**
 * Normalized contract errors + JSON responses.
 *
 * The contract (contract/openapi.yaml, "Erreurs normalisées") mandates REAL
 * HTTP status codes with the body shape:
 *
 *   { "error": { "code": "...", "message": "...", "details": null | {...} } }
 *
 * `message` is for logs only — the kiosk NEVER shows it to the patient.
 * The kiosk retries 5xx/network errors but treats every 4xx as final, so
 * returning the right status code matters.
 *
 * Every helper below attaches the CORS headers: the kiosk is a browser app
 * calling this editor cross-origin.
 */
import { NextResponse } from "next/server";
import { CORS_HEADERS } from "./cors";

export const ERROR_CODES = {
  INVALID_AUTH_KEY: 401,
  UNKNOWN_DEVICE: 401,
  INVALID_CREDENTIALS: 401,
  VALIDATION_ERROR: 400,
  UNKNOWN_PATIENT: 404,
  UNKNOWN_APPOINTMENT: 404,
  UNKNOWN_DOCUMENT: 404,
  ALREADY_CHECKED_IN: 409,
  UPLOAD_TOO_LARGE: 413,
  // End-to-end encryption (contract "Chiffrement de bout en bout"): the
  // envelope cannot be decrypted (unknown key, bad tag, malformed) — the
  // kiosk never retries and NEVER falls back to clear text.
  DECRYPTION_FAILED: 400,
  // Strict mode (automatic as soon as private keys are configured): reject
  // clear-text calls on communication routes. Not a contract code — a real
  // editor may enforce the same policy with any 400.
  ENCRYPTION_REQUIRED: 400,
  INTERNAL_ERROR: 500,
  NOT_SUPPORTED: 501,
} as const;

export type ContractErrorCode = keyof typeof ERROR_CODES;

/** JSON success response with CORS headers. */
export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

/** 204 No Content (PATCH /patients/{id}) with CORS headers. */
export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Normalized contract error response. */
export function contractError(
  code: ContractErrorCode,
  message: string,
  details: Record<string, unknown> | null = null,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, details } },
    { status: ERROR_CODES[code], headers: CORS_HEADERS },
  );
}

/**
 * Wraps a handler so that any uncaught exception becomes a clean
 * 500 INTERNAL_ERROR (real status → the kiosk will retry).
 */
export function withErrorBoundary<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse> | NextResponse,
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("[contract] unhandled error:", error);
      return contractError(
        "INTERNAL_ERROR",
        error instanceof Error ? error.message : "Unexpected error",
      );
    }
  };
}
