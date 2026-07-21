/**
 * DELETE /appointments/{appointmentId}/documents/{documentId} — operationId
 * `deleteAppointmentDocument` (OPTIONAL route, "documents" group)
 *
 * Used by the kiosk to replace a document (DELETE then POST). Deleting an
 * unknown document → 404 UNKNOWN_DOCUMENT.
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { contractError, noContent, withErrorBoundary } from "@/server/contract/errors";
import { resolveAppointment } from "@/server/contract/resolve";
import { deleteDocument, getDocument } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const DELETE = withErrorBoundary(
  async (
    request: NextRequest,
    context: { params: Promise<{ appointmentId: string; documentId: string }> },
  ) => {
    const authError = requireKioskAuth(request);
    if (authError) return authError;

    const { appointmentId, documentId } = await context.params;
    const appointment = resolveAppointment(appointmentId);
    if (!appointment) {
      return contractError("UNKNOWN_APPOINTMENT", `Appointment '${appointmentId}' not found`);
    }
    const document = getDocument(Number(documentId));
    if (!document || document.appointment_id !== appointment.id) {
      return contractError("UNKNOWN_DOCUMENT", `Document '${documentId}' not found`);
    }
    deleteDocument(document.id);
    return noContent();
  },
);
