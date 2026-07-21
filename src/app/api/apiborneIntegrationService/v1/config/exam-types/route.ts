/**
 * GET /config/exam-types — ApiBorne CONFIGURATION route (extension of the
 * kiosk contract, not part of openapi.yaml's 12 kiosk operations).
 *
 * Called by the APIBORNE SERVER (not a kiosk) to pull the editor's exam type
 * referential: names feed the admin screens, `ticketPrefix` seeds the call
 * ticket format ("RA" -> "RA-12"; ApiBorne admins can override prefixes
 * locally). The ApiBorne server also PROBES this route (plus
 * /config/office-places) to validate the integration before unlocking the
 * rest of its admin configuration.
 *
 * Auth exception (server-to-server): ONLY `X-Kiosk-Auth-Key` is required.
 *
 * Response shape expected by ApiBorne:
 *   { "examTypes": [ { "id": "1", "name": "Radiography", "ticketPrefix": "RA" } ] }
 */
import type { NextRequest } from "next/server";
import { requireAuthKey } from "@/server/contract/auth";
import { ok, withErrorBoundary } from "@/server/contract/errors";
import { listExamTypes } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const GET = withErrorBoundary(async (request: NextRequest) => {
  const authError = requireAuthKey(request);
  if (authError) return authError;

  return ok({
    examTypes: listExamTypes().map((examType) => ({
      id: String(examType.id),
      name: examType.name,
      ticketPrefix: examType.ticket_prefix,
    })),
  });
});
