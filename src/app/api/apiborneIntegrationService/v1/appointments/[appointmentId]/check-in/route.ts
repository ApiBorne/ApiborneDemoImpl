/**
 * POST /appointments/{appointmentId}/check-in — operationId `checkInAppointment`
 * (MANDATORY route — the critical operation of the whole contract)
 *
 * Contract semantics implemented here (contract/README.md "check-in"):
 *  - IDEMPOTENT: a network replay after a timeout must return 200 with the
 *    EXISTING ticket, never a duplicate check-in. We treat a `checkedIn`
 *    appointment as a replay.
 *  - 409 ALREADY_CHECKED_IN is reserved for truly incompatible states
 *    (done / cancelled — the journey is over).
 *  - `anomalyCodes` are vendor-neutral strings, stored VERBATIM.
 *  - Multi-appointment journeys: one call per appointment; `sequence.number`
 *    1 is the main one, later calls carry `mainAppointmentId`. The demo
 *    stores nothing special about the grouping — it simply checks each one in.
 *  - `proposedTicket` { number, formattedNumber }: the ticket the kiosk
 *    RESERVED on the ApiBorne server before calling us. The contract says the
 *    editor MAY adopt it and MUST accept it without error otherwise. This
 *    demo ADOPTS it — best practice, because the kiosk has already printed
 *    that number and adoption keeps the printed ticket, this agenda and the
 *    ApiBorne Cockpit all in sync. Without a proposal (no ApiBorne numbering)
 *    we fall back to a local per-day sequence.
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { withContractCrypto } from "@/server/contract/encryption";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import { resolveAppointment } from "@/server/contract/resolve";
import { dayWindowOf } from "@/server/contract/resolve";
import { notifyAppointmentStatusChanged } from "@/server/apiborne/client";
import {
  getAppointment,
  getExamType,
  listAppointmentsOfDay,
  setAppointmentCheckedIn,
} from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

/** Local fallback numbering: max ticket number of the day + 1. */
function nextLocalTicket(examTypeId: number): {
  number: number;
  formatted: string;
} {
  const { start, end } = dayWindowOf(new Date());
  const todays = listAppointmentsOfDay(start, end);
  const max = todays.reduce((m, a) => Math.max(m, a.ticket_number ?? 0), 0);
  const number = max + 1;
  const prefix = getExamType(examTypeId)?.ticket_prefix ?? null;
  return { number, formatted: prefix ? `${prefix}-${number}` : String(number) };
}

export const POST = withErrorBoundary(
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
        sequence?: { number?: number; count?: number };
        anomalyCodes?: string[];
        documentsComplete?: boolean | null;
        proposedTicket?: { number?: number; formattedNumber?: string } | null;
      } | null;
      if (!body?.sequence || typeof body.sequence.number !== "number") {
        return contractError("VALIDATION_ERROR", "sequence is required", {
          field: "sequence",
        });
      }

      // Idempotence: replaying the check-in of an already-checked-in (or later
      // in-care) appointment returns the existing ticket with 200.
      if (
        appointment.status === "checkedIn" ||
        appointment.status === "inCare"
      ) {
        return ok({
          ticketNumber: appointment.ticket_number,
          ticketNumberFormatted: appointment.ticket_number_formatted,
        });
      }
      // Truly incompatible states → 409 (the kiosk shows a dedicated message).
      if (appointment.status === "done" || appointment.status === "cancelled") {
        return contractError(
          "ALREADY_CHECKED_IN",
          `Appointment is '${appointment.status}', check-in is not possible`,
        );
      }

      // Ticket: ADOPT the kiosk's proposal (reserved on the ApiBorne server —
      // already printed), else local numbering.
      const proposed = body.proposedTicket;
      const ticket =
        proposed?.number && proposed.number > 0 && proposed.formattedNumber
          ? {
              number: proposed.number,
              formatted: proposed.formattedNumber,
              adopted: true,
            }
          : { ...nextLocalTicket(appointment.exam_type_id), adopted: false };
      console.info(
        `[contract] check-in appointment ${appointment.id}: ticket ${ticket.formatted} (${
          ticket.adopted ? "proposedTicket adopted" : "local numbering"
        })`,
      );

      setAppointmentCheckedIn(appointment.id, {
        ticketNumber: ticket.number,
        ticketNumberFormatted: ticket.formatted,
        anomalyCodes: Array.isArray(body.anomalyCodes)
          ? body.anomalyCodes
          : null,
        // Trace of the kiosk-reported "file complete/incomplete" flag (contract
        // `documentsComplete`, nullable — null when the kiosk skipped documents).
        documentsComplete:
          typeof body.documentsComplete === "boolean"
            ? body.documentsComplete
            : null,
      });

      // Keep the ApiBorne server in sync (best-effort, fire-and-forget). For a
      // kiosk check-in it already knows the ticket (reserve/confirm flow), so
      // this only refreshes the status — idempotent on its side.
      const updated = getAppointment(appointment.id);
      if (updated) {
        notifyAppointmentStatusChanged(updated, "checkedIn");
      }

      return ok({
        ticketNumber: ticket.number,
        ticketNumberFormatted: ticket.formatted,
      });
    },
  ),
);
