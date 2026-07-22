/**
 * GET /appointments/{appointmentId} — operationId `getAppointmentById`
 *
 * Reloads an appointment already known to the caller. Two callers rely on it:
 *  - the kiosk, after a patient update (canonical data reload);
 *  - the APIBORNE SERVER, which re-verifies every displayed ticket against
 *    this response (its "editor is the source of truth" reconciliation reads
 *    `appointment.status` and `appointment.startDate`).
 * Returns the same AppointmentDetail shape as by-code.
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
      return ok(toAppointmentDetail(appointment));
    },
  ),
);
