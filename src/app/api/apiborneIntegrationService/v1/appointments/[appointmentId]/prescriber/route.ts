/**
 * PUT /appointments/{appointmentId}/prescriber — operationId
 * `setAppointmentPrescriber` (OPTIONAL route)
 *
 * The kiosk sets the prescribing practitioner, either typed by the patient or
 * picked from the `analysis.prescriberProposals` returned by a prescription
 * upload. Body: { context?, prescriber: { name, rppsId? } }.
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { withContractCrypto } from "@/server/contract/encryption";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import { resolveAppointment } from "@/server/contract/resolve";
import { setAppointmentPrescriber } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const PUT = withErrorBoundary(
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

      const body = (await request.json().catch(() => null)) as {
        prescriber?: { name?: string; rppsId?: string | null };
      } | null;
      if (!body?.prescriber?.name) {
        return contractError(
          "VALIDATION_ERROR",
          "prescriber.name is required",
          {
            field: "prescriber",
          },
        );
      }

      setAppointmentPrescriber(
        appointment.id,
        body.prescriber.name,
        body.prescriber.rppsId ?? null,
      );
      return ok({});
    },
  ),
);
