/**
 * Typed shapes of the SQLite rows (snake_case, mirroring schema.sql) and the
 * few domain enums shared across the demo.
 *
 * The CONTRACT-facing DTO shapes (camelCase, ISO dates) live in
 * `src/server/contract/mappers.ts` — keeping the two worlds separate is the
 * whole point of the mappers layer.
 */

/** Appointment lifecycle — this IS the contract enum, used verbatim in DB. */
export type AppointmentStatus = "scheduled" | "checkedIn" | "inCare" | "done" | "cancelled";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "checkedIn",
  "inCare",
  "done",
  "cancelled",
];

export interface PractitionerRow {
  id: number;
  full_name: string;
  rpps_id: string | null;
  color: string;
}

export interface RoomRow {
  id: number;
  name: string;
}

export interface OfficePlaceRow {
  id: number;
  name: string;
}

export interface ExamRow {
  id: number;
  name: string;
  exam_type_id: number;
}

export interface ExamTypeRow {
  id: number;
  name: string;
  ticket_prefix: string;
}

export interface PatientRow {
  id: number;
  first_name: string;
  last_name: string;
  birth_date: string;
  social_security_id: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  address_line: string | null;
  address_line2: string | null;
  zip_code: string | null;
  city: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  referring_practitioner_name: string | null;
  referring_practitioner_rpps_id: string | null;
}

export interface AppointmentRow {
  id: number;
  visible_id: string;
  patient_id: number;
  practitioner_id: number;
  room_id: number | null;
  exam_type_id: number;
  exam_label: string;
  start_date: string;
  duration_minutes: number;
  status: AppointmentStatus;
  ticket_number: number | null;
  ticket_number_formatted: string | null;
  anomaly_codes: string | null;
  checked_in_at: string | null;
  prescriber_name: string | null;
  prescriber_rpps_id: string | null;
  /** NULL = no survey expected, 0 = expected but not filled, 1 = filled. */
  preparatory_survey_completed: number | null;
  /** JSON array of contract documentType strings; NULL = demo default. */
  required_document_types: string | null;
  /** Kiosk-reported documentsComplete at check-in: NULL = not handled, 0/1. */
  checkin_documents_complete: number | null;
}

export interface DocumentTypeRow {
  id: number;
  code: string;
  label: string;
}

export interface DocumentRow {
  id: number;
  appointment_id: number;
  document_type: string;
  label: string | null;
  rotation_angle: number;
  pages_json: string;
  created_at: string;
}

export interface StaffUserRow {
  id: number;
  login: string;
  password: string;
  display_name: string;
  email: string;
}

export interface KioskDeviceRow {
  device_id: string;
  label: string | null;
}

/** Keys of the `settings` table (seeded from .env.local, editable in /settings). */
export type SettingKey =
  | "kioskAuthKey"
  | "officeId"
  | "officeVisibleId"
  | "brandId"
  | "licenceUuid"
  | "apiborneServerBaseUrl"
  | "pushEnabled"
  | "enforceKnownDevices"
  // End-to-end encryption: one or more concatenated private key PEMs (newest
  // first — rotation), and the strict mode rejecting clear-text calls.
  | "contractEncryptionPrivateKeys"
  | "requireEncryption";
