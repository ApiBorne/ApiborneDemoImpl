/**
 * POST /staff/sign-in — operationId `staffSignIn` (OPTIONAL route, Cockpit)
 *
 * Called by the APIBORNE SERVER (not a kiosk) when a receptionist logs into
 * the ApiBorne Cockpit with the editor's credentials. Hence the auth
 * exception: ONLY `X-Kiosk-Auth-Key` is required (no device id).
 *
 * Success returns the offices the user can access — the ApiBorne server
 * matches them against its own `officeId`/`officeVisibleId` configuration to
 * resolve the licence. `userEmail` is the stable key for user preferences.
 */
import type { NextRequest } from "next/server";
import { requireAuthKey } from "@/server/contract/auth";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import { findStaffByLogin, getSetting } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const POST = withErrorBoundary(async (request: NextRequest) => {
  const authError = requireAuthKey(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as {
    login?: string;
    password?: string;
  } | null;
  if (!body?.login || !body?.password) {
    return contractError("VALIDATION_ERROR", "login and password are required");
  }

  // Demo shortcut: plain-text password comparison on the seeded account
  // (reception@demo-ris.example / demo1234). A real editor hashes passwords.
  const staff = findStaffByLogin(body.login);
  if (!staff || staff.password !== body.password) {
    return contractError("INVALID_CREDENTIALS", "Invalid login or password");
  }

  return ok({
    offices: [
      {
        officeId: getSetting("officeId"),
        officeVisibleId: getSetting("officeVisibleId"),
        name: "Demo Radiology Clinic",
      },
    ],
    userEmail: staff.email,
    userDisplayName: staff.display_name,
  });
});
