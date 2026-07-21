/**
 * GET /config/office-places — ApiBorne CONFIGURATION route (extension of the
 * kiosk contract, not part of openapi.yaml's 12 kiosk operations).
 *
 * Called by the APIBORNE SERVER (not a kiosk) to pull the editor's reference
 * data: the office places (waiting areas / sites) used to label boards and
 * counters in the ApiBorne admin and Cockpit. The ApiBorne server also PROBES
 * this route (plus /config/exam-types) to validate the integration before
 * unlocking the rest of its admin configuration.
 *
 * Auth exception (server-to-server): ONLY `X-Kiosk-Auth-Key` is required.
 *
 * Response shape expected by ApiBorne:
 *   { "officePlaces": [ { "id": "1", "name": "Main reception" } ] }
 *
 * The places live in the `office_places` referential (managed from the
 * /referentials page, seeded with a single site).
 */
import type { NextRequest } from "next/server";
import { requireAuthKey } from "@/server/contract/auth";
import { ok, withErrorBoundary } from "@/server/contract/errors";
import { listOfficePlaces } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const GET = withErrorBoundary(async (request: NextRequest) => {
  const authError = requireAuthKey(request);
  if (authError) return authError;

  // Référentiel géré dans la page /referentials (seedé avec un site unique) —
  // ids numériques SQLite exposés en string, comme les autres référentiels.
  return ok({
    officePlaces: listOfficePlaces().map((place) => ({
      id: String(place.id),
      name: place.name,
    })),
  });
});
