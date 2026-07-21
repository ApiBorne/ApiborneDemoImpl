/**
 * Typed data access — plain synchronous functions over the shared SQLite
 * connection. Each function does exactly one obvious thing; the contract
 * semantics (idempotency, status transitions, error mapping) live in the
 * route handlers, not here.
 */
import { getDb } from "./db";
import { newVisibleId } from "./seed";
import type {
  AppointmentRow,
  AppointmentStatus,
  DocumentRow,
  DocumentTypeRow,
  ExamRow,
  ExamTypeRow,
  KioskDeviceRow,
  OfficePlaceRow,
  PatientRow,
  PractitionerRow,
  RoomRow,
  SettingKey,
  StaffUserRow,
} from "./types";

// ---------------------------------------------------------------------------
// Settings / devices / staff
// ---------------------------------------------------------------------------

export function getSetting(key: SettingKey): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string | null }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: SettingKey, value: string): void {
  getDb()
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function listSettings(): Record<string, string | null> {
  const rows = getDb().prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string | null;
  }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function isKnownDevice(deviceId: string): boolean {
  const row = getDb()
    .prepare("SELECT device_id FROM kiosk_devices WHERE device_id = ?")
    .get(deviceId) as KioskDeviceRow | undefined;
  return row != null;
}

export function listDevices(): KioskDeviceRow[] {
  return getDb().prepare("SELECT * FROM kiosk_devices ORDER BY device_id").all() as KioskDeviceRow[];
}

/** Lenient mode: record a device on first contact (auth key already checked). */
export function registerDevice(deviceId: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO kiosk_devices (device_id, label) VALUES (?, ?)")
    .run(deviceId, "Auto-registered kiosk");
}

export function replaceDevices(deviceIds: string[]): void {
  const db = getDb();
  const tx = db.transaction((ids: string[]) => {
    db.prepare("DELETE FROM kiosk_devices").run();
    const insert = db.prepare("INSERT INTO kiosk_devices (device_id, label) VALUES (?, ?)");
    for (const id of ids) {
      insert.run(id, `Demo kiosk ${id}`);
    }
  });
  tx(deviceIds);
}

export function findStaffByLogin(login: string): StaffUserRow | undefined {
  return getDb().prepare("SELECT * FROM staff_users WHERE login = ?").get(login) as
    | StaffUserRow
    | undefined;
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export function listPractitioners(): PractitionerRow[] {
  return getDb().prepare("SELECT * FROM practitioners ORDER BY id").all() as PractitionerRow[];
}

export function listRooms(): RoomRow[] {
  return getDb().prepare("SELECT * FROM rooms ORDER BY id").all() as RoomRow[];
}

export function listOfficePlaces(): OfficePlaceRow[] {
  return getDb().prepare("SELECT * FROM office_places ORDER BY id").all() as OfficePlaceRow[];
}

export function listExamTypes(): ExamTypeRow[] {
  return getDb().prepare("SELECT * FROM exam_types ORDER BY id").all() as ExamTypeRow[];
}

export function getExamType(id: number): ExamTypeRow | undefined {
  return getDb().prepare("SELECT * FROM exam_types WHERE id = ?").get(id) as
    | ExamTypeRow
    | undefined;
}

export function listExams(): ExamRow[] {
  return getDb().prepare("SELECT * FROM exams ORDER BY exam_type_id, name").all() as ExamRow[];
}

// ---------------------------------------------------------------------------
// Referential CRUD (practitioners / rooms / exam types / exams) — behind the
// /referentials management page. Deletes are GUARDED: a row referenced by an
// appointment (or, for an exam type, by an exam) cannot be removed — the demo
// keeps history consistent instead of cascading.
// ---------------------------------------------------------------------------

function countWhere(sql: string, value: number): number {
  const row = getDb().prepare(sql).get(value) as { n: number };
  return row.n;
}

export function createPractitioner(data: { fullName: string; rppsId: string | null; color: string }): PractitionerRow {
  const result = getDb()
    .prepare("INSERT INTO practitioners (full_name, rpps_id, color) VALUES (?, ?, ?)")
    .run(data.fullName, data.rppsId, data.color);
  return getDb().prepare("SELECT * FROM practitioners WHERE id = ?").get(Number(result.lastInsertRowid)) as PractitionerRow;
}

export function updatePractitioner(id: number, data: { fullName: string; rppsId: string | null; color: string }): void {
  getDb()
    .prepare("UPDATE practitioners SET full_name = ?, rpps_id = ?, color = ? WHERE id = ?")
    .run(data.fullName, data.rppsId, data.color, id);
}

export function deletePractitioner(id: number): string | null {
  if (countWhere("SELECT COUNT(*) AS n FROM appointments WHERE practitioner_id = ?", id) > 0) {
    return "This practitioner has appointments and cannot be deleted";
  }
  getDb().prepare("DELETE FROM practitioners WHERE id = ?").run(id);
  return null;
}

export function createRoom(data: { name: string }): RoomRow {
  const result = getDb().prepare("INSERT INTO rooms (name) VALUES (?)").run(data.name);
  return getDb().prepare("SELECT * FROM rooms WHERE id = ?").get(Number(result.lastInsertRowid)) as RoomRow;
}

export function updateRoom(id: number, data: { name: string }): void {
  getDb().prepare("UPDATE rooms SET name = ? WHERE id = ?").run(data.name, id);
}

export function deleteRoom(id: number): string | null {
  if (countWhere("SELECT COUNT(*) AS n FROM appointments WHERE room_id = ?", id) > 0) {
    return "This room has appointments and cannot be deleted";
  }
  getDb().prepare("DELETE FROM rooms WHERE id = ?").run(id);
  return null;
}

export function updateAppointment(
  id: number,
  data: {
    patientId: number;
    practitionerId: number;
    roomId: number | null;
    examTypeId: number;
    examLabel: string;
    startDate: string;
    durationMinutes: number;
  },
): AppointmentRow | undefined {
  getDb()
    .prepare(
      `UPDATE appointments
       SET patient_id = ?, practitioner_id = ?, room_id = ?, exam_type_id = ?,
           exam_label = ?, start_date = ?, duration_minutes = ?
       WHERE id = ?`,
    )
    .run(
      data.patientId,
      data.practitionerId,
      data.roomId,
      data.examTypeId,
      data.examLabel,
      data.startDate,
      data.durationMinutes,
      id,
    );
  return getAppointment(id);
}

/** Replace the appointment's required document types (contract enum strings). */
export function setAppointmentRequiredDocumentTypes(id: number, types: string[]): void {
  getDb()
    .prepare("UPDATE appointments SET required_document_types = ? WHERE id = ?")
    .run(JSON.stringify(types), id);
}

/** NULL = no survey expected, false = expected not filled, true = filled. */
export function setAppointmentPreparatorySurvey(id: number, completed: boolean | null): void {
  getDb()
    .prepare("UPDATE appointments SET preparatory_survey_completed = ? WHERE id = ?")
    .run(completed == null ? null : completed ? 1 : 0, id);
}

/**
 * Required document types of an appointment — the per-appointment JSON column,
 * falling back to the demo default (a prescription for every exam) when unset.
 */
export function requiredDocumentTypesOf(appointment: AppointmentRow): string[] {
  if (appointment.required_document_types) {
    try {
      const parsed = JSON.parse(appointment.required_document_types) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === "string");
      }
    } catch {
      // fall through to the default
    }
  }
  return ["prescription"];
}

export function createOfficePlace(data: { name: string }): OfficePlaceRow {
  const result = getDb().prepare("INSERT INTO office_places (name) VALUES (?)").run(data.name);
  return getDb()
    .prepare("SELECT * FROM office_places WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as OfficePlaceRow;
}

export function updateOfficePlace(id: number, data: { name: string }): void {
  getDb().prepare("UPDATE office_places SET name = ? WHERE id = ?").run(data.name, id);
}

export function deleteOfficePlace(id: number): string | null {
  // Toujours garder au moins un lieu : /config/office-places est le
  // référentiel partagé (bornes, tableaux, compteurs par lieu)
  if (countWhere("SELECT COUNT(*) AS n FROM office_places WHERE id != ?", id) === 0) {
    return "At least one office place must remain";
  }
  getDb().prepare("DELETE FROM office_places WHERE id = ?").run(id);
  return null;
}

export function createExamType(data: { name: string; ticketPrefix: string }): ExamTypeRow {
  const result = getDb()
    .prepare("INSERT INTO exam_types (name, ticket_prefix) VALUES (?, ?)")
    .run(data.name, data.ticketPrefix);
  return getExamType(Number(result.lastInsertRowid))!;
}

export function updateExamType(id: number, data: { name: string; ticketPrefix: string }): void {
  getDb()
    .prepare("UPDATE exam_types SET name = ?, ticket_prefix = ? WHERE id = ?")
    .run(data.name, data.ticketPrefix, id);
}

export function deleteExamType(id: number): string | null {
  if (countWhere("SELECT COUNT(*) AS n FROM appointments WHERE exam_type_id = ?", id) > 0) {
    return "This exam type has appointments and cannot be deleted";
  }
  if (countWhere("SELECT COUNT(*) AS n FROM exams WHERE exam_type_id = ?", id) > 0) {
    return "This exam type still has exams — delete them first";
  }
  getDb().prepare("DELETE FROM exam_types WHERE id = ?").run(id);
  return null;
}

export function createExam(data: { name: string; examTypeId: number }): ExamRow {
  const result = getDb()
    .prepare("INSERT INTO exams (name, exam_type_id) VALUES (?, ?)")
    .run(data.name, data.examTypeId);
  return getDb().prepare("SELECT * FROM exams WHERE id = ?").get(Number(result.lastInsertRowid)) as ExamRow;
}

export function updateExam(id: number, data: { name: string; examTypeId: number }): void {
  getDb().prepare("UPDATE exams SET name = ?, exam_type_id = ? WHERE id = ?").run(data.name, data.examTypeId, id);
}

export function deleteExam(id: number): string | null {
  getDb().prepare("DELETE FROM exams WHERE id = ?").run(id);
  return null;
}

// ---------------------------------------------------------------------------
// Document types — THE EDITOR OWNS this referential (contract
// GET /config/document-types) : codes standard du contrat + codes maison,
// libellés affichables. Guard de suppression : un code utilisé par un
// document ou requis par un RDV ne peut pas disparaître.
// ---------------------------------------------------------------------------

export function listDocumentTypes(): DocumentTypeRow[] {
  return getDb().prepare("SELECT * FROM document_types ORDER BY id").all() as DocumentTypeRow[];
}

export function createDocumentType(data: { code: string; label: string }): DocumentTypeRow {
  const result = getDb()
    .prepare("INSERT INTO document_types (code, label) VALUES (?, ?)")
    .run(data.code, data.label);
  return getDb()
    .prepare("SELECT * FROM document_types WHERE id = ?")
    .get(Number(result.lastInsertRowid)) as DocumentTypeRow;
}

export function updateDocumentType(id: number, data: { code: string; label: string }): void {
  getDb()
    .prepare("UPDATE document_types SET code = ?, label = ? WHERE id = ?")
    .run(data.code, data.label, id);
}

export function deleteDocumentType(id: number): string | null {
  const row = getDb().prepare("SELECT code FROM document_types WHERE id = ?").get(id) as
    | { code: string }
    | undefined;
  if (!row) {
    return null;
  }
  const usedByDocument = getDb()
    .prepare("SELECT COUNT(*) AS n FROM documents WHERE document_type = ?")
    .get(row.code) as { n: number };
  if (usedByDocument.n > 0) {
    return "This document type is used by attached documents and cannot be deleted";
  }
  const requiredBy = getDb()
    .prepare(
      "SELECT COUNT(*) AS n FROM appointments WHERE required_document_types LIKE '%' || ? || '%'",
    )
    .get(`"${row.code}"`) as { n: number };
  if (requiredBy.n > 0) {
    return "This document type is required by appointments and cannot be deleted";
  }
  getDb().prepare("DELETE FROM document_types WHERE id = ?").run(id);
  return null;
}

/** Libellé affichable d'un code — repli sur le code brut (type inconnu). */
export function documentTypeLabelOf(code: string): string {
  const row = getDb()
    .prepare("SELECT label FROM document_types WHERE code = ?")
    .get(code) as { label: string } | undefined;
  return row?.label ?? code;
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export function listPatients(): PatientRow[] {
  return getDb().prepare("SELECT * FROM patients ORDER BY last_name, first_name").all() as PatientRow[];
}

export function getPatient(id: number): PatientRow | undefined {
  return getDb().prepare("SELECT * FROM patients WHERE id = ?").get(id) as PatientRow | undefined;
}

export function createPatient(data: {
  firstName: string;
  lastName: string;
  birthDate: string;
  socialSecurityId?: string | null;
}): PatientRow {
  const result = getDb()
    .prepare(
      "INSERT INTO patients (first_name, last_name, birth_date, social_security_id) VALUES (?, ?, ?, ?)",
    )
    .run(data.firstName, data.lastName, data.birthDate, data.socialSecurityId ?? null);
  return getPatient(Number(result.lastInsertRowid))!;
}

/**
 * Column-level PATCH used by the contract's PATCH /patients/{id} (204).
 *
 * `fields` is the contract's `PatientUpdate` shape (what the kiosk sends from
 * the identity-verification screen): flat fields + a NESTED `address` object
 * + a nested `referringPractitioner`. PATCH semantics: an absent field is
 * unchanged, an explicit `null` clears the value.
 */
export function patchPatient(id: number, fields: Record<string, unknown>): void {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    values.push(value == null ? null : typeof value === "number" ? value : String(value));
  };

  const flat: Record<string, string> = {
    firstName: "first_name",
    lastName: "last_name",
    birthDate: "birth_date",
    email: "email",
    mobilePhone: "mobile_phone",
    phone: "phone",
    heightCm: "height_cm",
    weightKg: "weight_kg",
  };
  for (const [field, column] of Object.entries(flat)) {
    if (field in fields) {
      set(column, fields[field]);
    }
  }
  // NIR: stored without spaces, like the seeded data.
  if ("socialSecurityId" in fields) {
    const nir = fields.socialSecurityId;
    set("social_security_id", nir == null ? null : String(nir).replace(/\s+/g, ""));
  }
  // Nested address: only the sub-fields PRESENT are patched; `address: null`
  // clears the whole address.
  if ("address" in fields) {
    const address = fields.address as Record<string, unknown> | null;
    const sub: [string, string][] = [
      ["line1", "address_line"],
      ["line2", "address_line2"],
      ["zipCode", "zip_code"],
      ["city", "city"],
    ];
    for (const [field, column] of sub) {
      if (address == null) {
        set(column, null);
      } else if (field in address) {
        set(column, address[field]);
      }
    }
  }
  // Nested referring practitioner ({ name, rppsId } or null).
  if ("referringPractitioner" in fields) {
    const rp = fields.referringPractitioner as { name?: unknown; rppsId?: unknown } | null;
    set("referring_practitioner_name", rp?.name ?? null);
    set("referring_practitioner_rpps_id", rp?.rppsId ?? null);
  }

  if (sets.length === 0) {
    return;
  }
  getDb()
    .prepare(`UPDATE patients SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values, id);
}

/**
 * Multi-criteria patient search for POST /patients/identify. Contract rules:
 * ALL provided criteria are COMBINED (AND) and the result is capped (~10).
 *
 * The NIR is NOT exclusive: on a French family Vitale card, every beneficiary
 * (insured + dependents) shares the SAME NIR — matching by NIR alone would
 * return the insured's record for each beneficiary, and the kiosk (which
 * searches once per beneficiary) would see the same patient in triplicate.
 * The identity criteria (name/birth date) are what discriminate beneficiaries.
 */
export function searchPatients(criteria: {
  socialSecurityId?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  birthDate?: string | null;
}): PatientRow[] {
  const where: string[] = [];
  const values: string[] = [];
  if (criteria.socialSecurityId) {
    where.push("social_security_id = ?");
    values.push(criteria.socialSecurityId);
  }
  if (criteria.lastName) {
    where.push("UPPER(last_name) = UPPER(?)");
    values.push(criteria.lastName.trim());
  }
  if (criteria.firstName) {
    where.push("UPPER(first_name) = UPPER(?)");
    values.push(criteria.firstName.trim());
  }
  if (criteria.birthDate) {
    where.push("birth_date = ?");
    values.push(criteria.birthDate.trim());
  }
  if (where.length === 0) {
    return [];
  }
  return getDb()
    .prepare(`SELECT * FROM patients WHERE ${where.join(" AND ")} LIMIT 10`)
    .all(...values) as PatientRow[];
}

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export function getAppointment(id: number): AppointmentRow | undefined {
  return getDb().prepare("SELECT * FROM appointments WHERE id = ?").get(id) as
    | AppointmentRow
    | undefined;
}

export function getAppointmentByVisibleId(visibleId: string): AppointmentRow | undefined {
  return getDb().prepare("SELECT * FROM appointments WHERE visible_id = ?").get(visibleId) as
    | AppointmentRow
    | undefined;
}

/** Appointments of one calendar day (local), for the agenda and identify. */
export function listAppointmentsOfDay(dayStart: Date, dayEnd: Date): AppointmentRow[] {
  return getDb()
    .prepare("SELECT * FROM appointments WHERE start_date >= ? AND start_date < ? ORDER BY start_date")
    .all(dayStart.toISOString(), dayEnd.toISOString()) as AppointmentRow[];
}

/**
 * Day appointments of a patient for the KIOSK JOURNEY (identify + linked
 * appointments). Cancelled appointments are EXCLUDED: offering one to the
 * kiosk would walk the patient through the whole flow only to fail at
 * check-in with 409 — a real editor does not list them either.
 */
export function listAppointmentsOfPatientOnDay(
  patientId: number,
  dayStart: Date,
  dayEnd: Date,
): AppointmentRow[] {
  return getDb()
    .prepare(
      "SELECT * FROM appointments WHERE patient_id = ? AND start_date >= ? AND start_date < ? AND status != 'cancelled' ORDER BY start_date",
    )
    .all(patientId, dayStart.toISOString(), dayEnd.toISOString()) as AppointmentRow[];
}

export function createAppointment(data: {
  patientId: number;
  practitionerId: number;
  roomId: number | null;
  examTypeId: number;
  examLabel: string;
  startDate: string;
  durationMinutes: number;
}): AppointmentRow {
  const result = getDb()
    .prepare(
      `INSERT INTO appointments (visible_id, patient_id, practitioner_id, room_id, exam_type_id, exam_label, start_date, duration_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
    )
    .run(
      newVisibleId(),
      data.patientId,
      data.practitionerId,
      data.roomId,
      data.examTypeId,
      data.examLabel,
      data.startDate,
      data.durationMinutes,
    );
  return getAppointment(Number(result.lastInsertRowid))!;
}

export function updateAppointmentStatus(id: number, status: AppointmentStatus): void {
  getDb().prepare("UPDATE appointments SET status = ? WHERE id = ?").run(status, id);
}

export function setAppointmentCheckedIn(
  id: number,
  data: {
    ticketNumber: number | null;
    ticketNumberFormatted: string | null;
    anomalyCodes: string[] | null;
    /** Kiosk-reported "file complete" flag; null/undefined = kiosk did not handle documents. */
    documentsComplete?: boolean | null;
  },
): void {
  getDb()
    .prepare(
      `UPDATE appointments
       SET status = 'checkedIn', checked_in_at = ?, ticket_number = ?, ticket_number_formatted = ?, anomaly_codes = ?,
           checkin_documents_complete = ?
       WHERE id = ?`,
    )
    .run(
      new Date().toISOString(),
      data.ticketNumber,
      data.ticketNumberFormatted,
      data.anomalyCodes ? JSON.stringify(data.anomalyCodes) : null,
      data.documentsComplete == null ? null : data.documentsComplete ? 1 : 0,
      id,
    );
}

/**
 * Cancel the ticket and undo the check-in so the patient can redo the whole
 * kiosk journey: back to `scheduled`, ticket cleared (a new kiosk check-in
 * reserves a NEW number), check-in traces wiped (anomalies, documentsComplete).
 * Attached documents and the survey state are KEPT — they belong to the
 * patient file, not to the check-in attempt.
 */
export function resetAppointmentCheckin(id: number): void {
  getDb()
    .prepare(
      `UPDATE appointments
       SET status = 'scheduled', ticket_number = NULL, ticket_number_formatted = NULL,
           checked_in_at = NULL, anomaly_codes = NULL, checkin_documents_complete = NULL
       WHERE id = ?`,
    )
    .run(id);
}

export function setAppointmentTicket(id: number, number: number, formatted: string): void {
  getDb()
    .prepare("UPDATE appointments SET ticket_number = ?, ticket_number_formatted = ? WHERE id = ?")
    .run(number, formatted, id);
}

export function setAppointmentPrescriber(id: number, name: string | null, rppsId: string | null): void {
  getDb()
    .prepare("UPDATE appointments SET prescriber_name = ?, prescriber_rpps_id = ? WHERE id = ?")
    .run(name, rppsId, id);
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export function listDocuments(appointmentId: number): DocumentRow[] {
  return getDb()
    .prepare("SELECT * FROM documents WHERE appointment_id = ? ORDER BY id")
    .all(appointmentId) as DocumentRow[];
}

export function getDocument(id: number): DocumentRow | undefined {
  return getDb().prepare("SELECT * FROM documents WHERE id = ?").get(id) as DocumentRow | undefined;
}

export function createDocument(data: {
  appointmentId: number;
  documentType: string;
  label: string | null;
  rotationAngle: number;
  pages: { contentBase64: string; mimeType: string }[];
}): DocumentRow {
  const result = getDb()
    .prepare(
      `INSERT INTO documents (appointment_id, document_type, label, rotation_angle, pages_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      data.appointmentId,
      data.documentType,
      data.label,
      data.rotationAngle,
      JSON.stringify(data.pages),
      new Date().toISOString(),
    );
  return getDocument(Number(result.lastInsertRowid))!;
}

export function deleteDocument(id: number): void {
  getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
}
