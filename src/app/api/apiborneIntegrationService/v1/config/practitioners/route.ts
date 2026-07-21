/**
 * GET /config/practitioners — ApiBorne CONFIGURATION route (extension of the
 * kiosk contract). Exposes the practitioner referential to the ApiBorne
 * server (same family as EasyDoct's config service). Probed with the other
 * /config/* routes to validate the integration.
 *
 * Auth exception (server-to-server): ONLY `X-Kiosk-Auth-Key` is required.
 *
 * Response shape expected by ApiBorne:
 *   { "practitioners": [ { "id": "1", "name": "Dr Alice MARTIN", "rppsId": "..." } ] }
 */
import type { NextRequest } from "next/server";
import { requireAuthKey } from "@/server/contract/auth";
import { ok, withErrorBoundary } from "@/server/contract/errors";
import { listPractitioners } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const GET = withErrorBoundary(async (request: NextRequest) => {
  const authError = requireAuthKey(request);
  if (authError) return authError;

  return ok({
    practitioners: listPractitioners().map((practitioner) => ({
      id: String(practitioner.id),
      name: practitioner.full_name,
      rppsId: practitioner.rpps_id,
    })),
  });
});
