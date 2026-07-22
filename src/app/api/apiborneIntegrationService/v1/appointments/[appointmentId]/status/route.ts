/**
 * PUT /appointments/{appointmentId}/status — operationId `setAppointmentStatus`
 * (OPTIONAL route, Cockpit)
 *
 * Called by the APIBORNE SERVER (auth-key only, like staff/sign-in) to
 * reflect a status change made in the ApiBorne Cockpit. Contract semantics:
 *  - FORWARD-ONLY progression: checkedIn → inCare → done;
 *  - idempotent: already at (or past) the target → 200 without effect;
 *  - a cancelled or done appointment cannot be changed → 400 VALIDATION_ERROR.
 */
import type { NextRequest } from "next/server";
import { requireAuthKey } from "@/server/contract/auth";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import { resolveAppointment } from "@/server/contract/resolve";
import { notifyAppointmentStatusChanged } from "@/server/apiborne/client";
import {
  getAppointment,
  updateAppointmentStatus,
} from "@/server/db/repositories";
import type { AppointmentStatus } from "@/server/db/types";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

/** Forward progression order — index comparison implements "never backward". */
const FORWARD_ORDER: AppointmentStatus[] = [
  "scheduled",
  "checkedIn",
  "inCare",
  "done",
];
const ALLOWED_TARGETS: AppointmentStatus[] = ["checkedIn", "inCare", "done"];

export const PUT = withErrorBoundary(
  async (
    request: NextRequest,
    context: { params: Promise<{ appointmentId: string }> },
  ) => {
    const authError = requireAuthKey(request);
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
      status?: string;
    } | null;
    const target = body?.status as AppointmentStatus | undefined;
    if (!target || !ALLOWED_TARGETS.includes(target)) {
      return contractError(
        "VALIDATION_ERROR",
        "status must be one of checkedIn|inCare|done",
        {
          field: "status",
        },
      );
    }

    if (appointment.status === "cancelled") {
      return contractError(
        "VALIDATION_ERROR",
        "a cancelled appointment cannot be changed through the contract",
      );
    }

    const currentIndex = FORWARD_ORDER.indexOf(appointment.status);
    const targetIndex = FORWARD_ORDER.indexOf(target);
    if (targetIndex > currentIndex) {
      updateAppointmentStatus(appointment.id, target);
      // Symmetric with agenda-made changes: notify the ApiBorne server so its
      // tickets/externalStatus stay in sync (idempotent on its side).
      const updated = getAppointment(appointment.id);
      if (updated) {
        notifyAppointmentStatusChanged(updated, target);
      }
    }
    // At or past the target → idempotent success without effect.
    return ok({ status: target });
  },
);
