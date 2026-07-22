/**
 * GET /appointments/{appointmentId}/notification-readiness — operationId
 * `getNotificationReadiness` (MANDATORY route)
 *
 * The kiosk asks, right before check-in, whether the editor can notify the
 * medical team. The contract requires this route to ALWAYS answer (worst
 * case `{ "ready": true }` — never 501): the kiosk blocks the journey on a
 * negative answer. The demo has no notification pipeline, so it always says
 * ready. `reason` would be 'notificationNotConfigured' | 'notificationDisabled'.
 *
 * Query params sent by the kiosk (identifiedWithHealthCard, sequenceNumber,
 * examId, otherExamIds) are accepted and ignored here.
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { withContractCrypto } from "@/server/contract/encryption";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import { resolveAppointment } from "@/server/contract/resolve";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const GET = withErrorBoundary(
  withContractCrypto(
    async (
      request: NextRequest,
      context: { params: Promise<{ appointmentId: string }> },
    ) => {
      const authError = requireKioskAuth(request);
      if (authError) return authError;

      const { appointmentId } = await context.params;
      const appointment = resolveAppointment(appointmentId);
      if (!appointment) {
        return contractError(
          "UNKNOWN_APPOINTMENT",
          `Appointment '${appointmentId}' not found`,
        );
      }
      return ok({ ready: true });
    },
  ),
);
