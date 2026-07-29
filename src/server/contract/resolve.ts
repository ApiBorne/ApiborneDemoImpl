/**
 * Appointment resolution + the AppointmentDetail response shape shared by
 * GET /appointments/{id} and GET /appointments/by-code/{code}.
 */
import {
  getAppointment,
  getAppointmentByVisibleId,
  getPatient,
  getSetting,
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

/**
 * Day window around a date IN THE OFFICE TIMEZONE (setting `officeTimezone`,
 * default Europe/Paris) — the contract works on "today's" journey as the
 * PATIENT lives it. Computing the day in the server's local time broke on
 * cloud hosts running in UTC: between midnight and 2am French (summer) time,
 * `identify` searched YESTERDAY's appointments and found none.
 */
export function dayWindowOf(date: Date): { start: Date; end: Date } {
  const timeZone = getSetting("officeTimezone") || "Europe/Paris";
  try {
    // `date` as wall-clock time of the office; midnight of that wall-clock
    // day, shifted back by the (server-local vs office) offset, gives the
    // UTC instant of the office's midnight. Approximation acceptable for a
    // demo around DST transitions.
    const local = new Date(date.toLocaleString("en-US", { timeZone }));
    const startLocal = new Date(local);
    startLocal.setHours(0, 0, 0, 0);
    const offset = date.getTime() - local.getTime();
    const start = new Date(startLocal.getTime() + offset);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { start, end };
  } catch {
    // Fuseau invalide dans les settings : repli sur la journée locale serveur.
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }
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
