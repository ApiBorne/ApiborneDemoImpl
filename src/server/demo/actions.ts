/**
 * Agenda-side domain actions (used by the demo UI API under /api/demo/**).
 *
 * The interesting one is `changeAppointmentStatus`: it is the demo's
 * equivalent of a receptionist working in the editor's agenda, and it shows
 * WHEN an editor should talk to the ApiBorne server:
 *
 *  - marking an ARRIVAL (scheduled → checkedIn) asks ApiBorne for the ticket
 *    number (`issueForAppointment`) so kiosk check-ins and agenda arrivals
 *    share ONE sequence; on failure it falls back to local numbering
 *    (never block the receptionist);
 *  - EVERY status change fires `appointmentStatusChanged` (best-effort) so
 *    the ApiBorne Cockpit reflects the agenda in ~1-2 s.
 */
import {
  cancelTicketForAppointment,
  issueTicketForAppointment,
  notifyAppointmentStatusChanged,
} from "@/server/apiborne/client";
import { dayWindowOf } from "@/server/contract/resolve";
import {
  getAppointment,
  getExamType,
  getPatient,
  listAppointmentsOfDay,
  resetAppointmentCheckin,
  setAppointmentTicket,
  updateAppointmentStatus,
} from "@/server/db/repositories";
import type { AppointmentRow, AppointmentStatus } from "@/server/db/types";

function nextLocalTicket(examTypeId: number): { number: number; formatted: string } {
  const { start, end } = dayWindowOf(new Date());
  const todays = listAppointmentsOfDay(start, end);
  const max = todays.reduce((m, a) => Math.max(m, a.ticket_number ?? 0), 0);
  const number = max + 1;
  const prefix = getExamType(examTypeId)?.ticket_prefix ?? null;
  return { number, formatted: prefix ? `${prefix}-${number}` : String(number) };
}

export async function changeAppointmentStatus(
  appointmentId: number,
  status: AppointmentStatus,
): Promise<AppointmentRow | null> {
  const appointment = getAppointment(appointmentId);
  if (!appointment) {
    return null;
  }

  // Arrival marked in the agenda and no ticket yet → the ticket number comes
  // from the ApiBorne server (shared sequence with kiosk check-ins).
  if (status === "checkedIn" && appointment.ticket_number == null) {
    const patient = getPatient(appointment.patient_id);
    const prefix = getExamType(appointment.exam_type_id)?.ticket_prefix ?? null;
    const issued = await issueTicketForAppointment(
      appointment,
      prefix,
      patient ? `${patient.first_name} ${patient.last_name}` : null,
    );
    const ticket = issued
      ? { number: issued.number, formatted: issued.formattedNumber }
      : nextLocalTicket(appointment.exam_type_id); // fallback: never block
    setAppointmentTicket(appointment.id, ticket.number, ticket.formatted);
  }

  updateAppointmentStatus(appointment.id, status);
  const updated = getAppointment(appointment.id)!;
  notifyAppointmentStatusChanged(updated, status);
  return updated;
}

/**
 * "Cancel ticket": void the check-in so the patient can redo the WHOLE kiosk
 * journey. Local reset (scheduled, ticket cleared) + ApiBorne cancellation of
 * the day's tickets (they leave the Cockpit) + status push. Without this, the
 * kiosk would answer "already checked in" (the appointment still carries its
 * ticket, same rule as EasyDoct).
 */
export async function cancelAppointmentTicket(appointmentId: number): Promise<AppointmentRow | null> {
  const appointment = getAppointment(appointmentId);
  if (!appointment) {
    return null;
  }
  // Cancel on the ApiBorne side FIRST (needs the current contract id) — best
  // effort: a failure never blocks the local reset.
  await cancelTicketForAppointment(appointment).catch(() => undefined);
  resetAppointmentCheckin(appointment.id);
  const updated = getAppointment(appointment.id)!;
  notifyAppointmentStatusChanged(updated, "scheduled");
  return updated;
}
