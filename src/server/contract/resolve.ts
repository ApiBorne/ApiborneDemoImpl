/**
 * Appointment resolution + the AppointmentDetail response shape shared by
 * GET /appointments/{id} and GET /appointments/by-code/{code}.
 */
import {
  getAppointment,
  getAppointmentByVisibleId,
  getPatient,
  listAppointmentsOfPatientOnDay,
} from "@/server/db/repositories";
import type { AppointmentRow } from "@/server/db/types";
import {
  decodeAppointmentId,
  toContractAppointment,
  toContractPatient,
} from "./mappers";

/** Resolves a contract appointment id ("{id}~{visibleId}" or bare visibleId). */
export function resolveAppointment(contractId: string): AppointmentRow | null {
  const decoded = decodeAppointmentId(contractId);
  if (!decoded) {
    return null;
  }
  if (decoded.id != null) {
    const byId = getAppointment(decoded.id);
    // Both halves must match: the visibleId acts as a proof of possession.
    if (byId && byId.visible_id === decoded.visibleId) {
      return byId;
    }
    return null;
  }
  return decoded.visibleId
    ? (getAppointmentByVisibleId(decoded.visibleId) ?? null)
    : null;
}

/** Local-day window around a date (the contract works on "today's" journey). */
export function dayWindowOf(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * AppointmentDetail: the targeted appointment, its patient, and the patient's
 * OTHER appointments of the same day (multi-appointment journeys).
 */
export function toAppointmentDetail(appointment: AppointmentRow) {
  const patient = getPatient(appointment.patient_id);
  const { start, end } = dayWindowOf(new Date(appointment.start_date));
  const others = listAppointmentsOfPatientOnDay(
    appointment.patient_id,
    start,
    end,
  ).filter((a) => a.id !== appointment.id);
  return {
    patient: patient ? toContractPatient(patient) : null,
    appointment: toContractAppointment(appointment),
    otherAppointments: others.map(toContractAppointment),
    vendorData: null,
  };
}
