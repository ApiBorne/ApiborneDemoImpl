/**
 * GET /appointments/by-code/{code} — operationId `getAppointmentByCode`
 *
 * QR-code entry point. The code format is FREE (editor-defined): this demo
 * uses the appointment `visible_id` (a UUID) as the QR payload, and also
 * accepts the full "{id}~{visibleId}" contract id. The kiosk URL-encodes the
 * code; Next.js decodes the path param before we see it.
 *
 * Not found → 404 UNKNOWN_APPOINTMENT (the kiosk shows its own message).
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { withContractCrypto } from "@/server/contract/encryption";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import {
  resolveAppointment,
  toAppointmentDetail,
} from "@/server/contract/resolve";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const GET = withErrorBoundary(
  withContractCrypto(
    async (
      request: NextRequest,
      context: { params: Promise<{ code: string }> },
    ) => {
      const authError = requireKioskAuth(request);
      if (authError) return authError;

      const { code } = await context.params;
      const appointment = resolveAppointment(code);
      if (!appointment) {
        return contractError(
          "UNKNOWN_APPOINTMENT",
          `No appointment for code '${code}'`,
        );
      }
      return ok(toAppointmentDetail(appointment));
    },
  ),
);
