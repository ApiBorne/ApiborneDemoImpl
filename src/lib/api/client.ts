/**
 * Typed fetch client for the demo's INTERNAL UI API (/api/demo/**).
 * Same-origin calls — no auth: the demo UI is open by design.
 */

export type AppointmentStatus = "scheduled" | "checkedIn" | "inCare" | "done" | "cancelled";

export interface UiPractitioner {
  id: number;
  fullName: string;
  rppsId: string | null;
  color: string;
}
export interface UiRoom {
  id: number;
  name: string;
}
export interface UiOfficePlace {
  id: number;
  name: string;
}
export interface UiExamType {
  id: number;
  name: string;
  ticketPrefix: string;
}
export interface UiExam {
  id: number;
  name: string;
  examTypeId: number;
}
export interface UiDocumentType {
  id: number;
  /** Code contrat (vocabulaire standard ou code propre à l'éditeur). */
  code: string;
  label: string;
}
export interface UiPatient {
  id: number;
  firstName: string;
  lastName: string;
  birthDate: string;
  socialSecurityId: string | null;
  email: string | null;
  phone: string | null;
  /** Edited from the kiosk's identity-verification screen (contract PATCH). */
  mobilePhone: string | null;
  city: string | null;
  referringPractitionerName: string | null;
}
export interface UiAppointment {
  id: number;
  visibleId: string;
  patientId: number;
  patientName: string;
  practitionerId: number;
  roomId: number | null;
  /** Site of the appointment (office place id); null = single-site legacy. */
  officePlaceId: number | null;
  examTypeId: number;
  examLabel: string;
  startDate: string;
  durationMinutes: number;
  status: AppointmentStatus;
  ticketNumberFormatted: string | null;
  anomalyCodes: string[];
  prescriberName: string | null;
  /** Contract documentType strings required for this appointment. */
  requiredDocumentTypes: string[];
  /** Required types with no attached document yet. */
  missingDocumentTypes: string[];
  /** null = no survey expected, false = expected not filled, true = filled. */
  preparatorySurveyCompleted: boolean | null;
  /** Kiosk-reported `documentsComplete` at check-in (null = not handled). */
  checkinDocumentsComplete: boolean | null;
}

export interface UiDocument {
  id: number;
  documentType: string;
  label: string;
  createdAt: string;
  pageCount: number;
  /** Pages as data URIs, ready for <img src>. */
  pages: string[];
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(path, init);
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export function getReference(): Promise<{
  practitioners: UiPractitioner[];
  rooms: UiRoom[];
  officePlaces: UiOfficePlace[];
  examTypes: UiExamType[];
  exams: UiExam[];
  documentTypes: UiDocumentType[];
}> {
  return request("GET", "/api/demo/reference");
}

// --- Referential management (/referentials page) ---

export type ReferentialKind =
  | "practitioners"
  | "rooms"
  | "examTypes"
  | "exams"
  | "officePlaces"
  | "documentTypes";

export function createReferential(
  kind: ReferentialKind,
  data: Record<string, unknown>,
): Promise<{ id: number }> {
  return request("POST", `/api/demo/referentials/${kind}`, data);
}

export function updateReferential(
  kind: ReferentialKind,
  id: number,
  data: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return request("PUT", `/api/demo/referentials/${kind}/${id}`, data);
}

export function deleteReferential(kind: ReferentialKind, id: number): Promise<{ ok: boolean }> {
  return request("DELETE", `/api/demo/referentials/${kind}/${id}`);
}

export function getAppointments(date: string): Promise<{ appointments: UiAppointment[] }> {
  return request("GET", `/api/demo/appointments?date=${encodeURIComponent(date)}`);
}

export function createAppointment(data: {
  patientId: number;
  practitionerId: number;
  roomId: number | null;
  officePlaceId: number | null;
  examTypeId: number;
  examLabel: string;
  startDate: string;
  durationMinutes: number;
}): Promise<{ appointment: UiAppointment }> {
  return request("POST", "/api/demo/appointments", data);
}

export function updateAppointment(
  appointmentId: number,
  data: {
    patientId: number;
    practitionerId: number;
    roomId: number | null;
    officePlaceId: number | null;
    examTypeId: number;
    examLabel: string;
    startDate: string;
    durationMinutes: number;
  },
): Promise<{ appointment: UiAppointment }> {
  return request("PUT", `/api/demo/appointments/${appointmentId}`, data);
}

export function getAppointmentDocuments(
  appointmentId: number,
): Promise<{ documents: UiDocument[]; requiredDocumentTypes: string[] }> {
  return request("GET", `/api/demo/appointments/${appointmentId}/documents`);
}

export function addAppointmentDocument(
  appointmentId: number,
  data: {
    documentType: string;
    label?: string;
    /** Optional scans; without them the demo stores a placeholder page. */
    pages?: { contentBase64: string; mimeType: string }[];
  },
): Promise<{ document: UiDocument }> {
  return request("POST", `/api/demo/appointments/${appointmentId}/documents`, data);
}

export function deleteAppointmentDocument(
  appointmentId: number,
  documentId: number,
): Promise<{ ok: boolean }> {
  return request("DELETE", `/api/demo/appointments/${appointmentId}/documents/${documentId}`);
}

export function setRequiredDocumentTypes(
  appointmentId: number,
  types: string[],
): Promise<{ ok: boolean; types: string[] }> {
  return request("PUT", `/api/demo/appointments/${appointmentId}/required-documents`, { types });
}

export function setPreparatorySurvey(
  appointmentId: number,
  completed: boolean | null,
): Promise<{ ok: boolean; completed: boolean | null }> {
  return request("PUT", `/api/demo/appointments/${appointmentId}/survey`, { completed });
}

export function changeStatus(
  appointmentId: number,
  status: AppointmentStatus,
): Promise<{ appointment: UiAppointment }> {
  return request("POST", `/api/demo/appointments/${appointmentId}/status`, { status });
}

export function cancelTicket(appointmentId: number): Promise<{ appointment: UiAppointment }> {
  return request("POST", `/api/demo/appointments/${appointmentId}/cancel-ticket`);
}

export function generateAppointments(
  date: string,
  count: number,
): Promise<{ appointments: UiAppointment[] }> {
  return request("POST", "/api/demo/appointments/generate", { date, count });
}

export function getPatients(): Promise<{ patients: UiPatient[] }> {
  return request("GET", "/api/demo/patients");
}

export function createPatient(data: {
  firstName: string;
  lastName: string;
  birthDate: string;
  socialSecurityId?: string;
}): Promise<{ patient: UiPatient }> {
  return request("POST", "/api/demo/patients", data);
}

export function getSettings(): Promise<{
  settings: Record<string, string | null>;
  deviceIds: string[];
}> {
  return request("GET", "/api/demo/settings");
}

export function saveSettings(data: {
  settings: Record<string, string>;
  /** Absent = liste des devices inchangée (gérés dans l'admin ApiBorne). */
  deviceIds?: string[];
}): Promise<{ settings: Record<string, string | null>; deviceIds: string[] }> {
  return request("PUT", "/api/demo/settings", data);
}

export function resetDemoData(): Promise<{ ok: boolean }> {
  return request("POST", "/api/demo/reset");
}
