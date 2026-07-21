/**
 * GET /config/rooms — ApiBorne CONFIGURATION route (extension of the kiosk
 * contract). Exposes the exam-room referential to the ApiBorne server (used
 * e.g. by board configuration). Probed with the other /config/* routes to
 * validate the integration.
 *
 * Auth exception (server-to-server): ONLY `X-Kiosk-Auth-Key` is required.
 *
 * Response shape expected by ApiBorne:
 *   { "rooms": [ { "id": "1", "name": "Room 1 — X-ray" } ] }
 */
import type { NextRequest } from "next/server";
import { requireAuthKey } from "@/server/contract/auth";
import { ok, withErrorBoundary } from "@/server/contract/errors";
import { listRooms } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const GET = withErrorBoundary(async (request: NextRequest) => {
  const authError = requireAuthKey(request);
  if (authError) return authError;

  return ok({
    rooms: listRooms().map((room) => ({
      id: String(room.id),
      name: room.name,
    })),
  });
});
