/**
 * SQLite rows → contract DTOs.
 *
 * This is the ONLY place that knows both worlds:
 *  - internal rows are snake_case (see src/server/db/types.ts);
 *  - the contract is camelCase, ISO 8601 dates, opaque string ids
 *    (contract/openapi.yaml — schemas Patient, Appointment, AppointmentDetail,
 *    Document).
 *
 * Appointment id convention: the contract id is "{id}~{visibleId}" — the same
 * encoding EasyDoct uses (KioskIntegrationMappers.EncodeAppointmentId), which
 * keeps this demo drop-in compatible with the ApiBorne server reconciliation
 * (it stores this value as `contractAppointmentId` on its tickets).
 *
 * vendorData: the contract lets the editor attach an opaque object that the
 * kiosk echoes back untouched on later calls about the same entity. The demo
 * uses it to carry its internal SQLite ids — a realistic pattern for editors
 * whose public ids differ from their primary keys.
 */
import { listExams, listOfficePlaces } from "@/server/db/repositories";
import type {
  AppointmentRow,
  PatientRow,
  DocumentRow,
} from "@/server/db/types";

export function encodeAppointmentId(
  appointment: Pick<AppointmentRow, "id" | "visible_id">,
): string {
  return `${appointment.id}~${appointment.visible_id}`;
}

/**
 * Decodes "{id}~{visibleId}" (also accepts a bare visibleId, since the QR code
 * of this demo is the visibleId alone). Returns null when nothing matches.
 */
export function decodeAppointmentId(
  contractId: string,
): { id?: number; visibleId?: string } | null {
  if (!contractId) {
    return null;
  }
  const separatorIndex = contractId.indexOf("~");
  if (separatorIndex > 0) {
    const id = Number(contractId.slice(0, separatorIndex));
    const visibleId = contractId.slice(separatorIndex + 1);
    if (Number.isFinite(id)) {
      return { id, visibleId };
    }
  }
  return { visibleId: contractId };
}

export function toContractPatient(patient: PatientRow) {
  return {
    id: String(patient.id),
    firstName: patient.first_name,
    lastName: patient.last_name,
    birthDate: patient.birth_date,
    socialSecurityId: patient.social_security_id,
    email: patient.email,
    // Every PatientUpdate-editable field is exposed so the kiosk's
    // identity-verification form prefills completely — the kiosk sends the
    // WHOLE form back on save, so a missing prefill would erase the value.
    mobilePhone: patient.mobile_phone,
    phone: patient.phone,
    address:
      patient.address_line ||
      patient.address_line2 ||
      patient.zip_code ||
      patient.city
        ? {
            line1: patient.address_line,
            line2: patient.address_line2,
            zipCode: patient.zip_code,
            city: patient.city,
          }
        : null,
    heightCm: patient.height_cm,
    weightKg: patient.weight_kg,
    referringPractitioner: patient.referring_practitioner_name
      ? {
          name: patient.referring_practitioner_name,
          rppsId: patient.referring_practitioner_rpps_id,
        }
      : null,
    vendorData: { sqlitePatientId: patient.id },
  };
}

export function toContractAppointment(appointment: AppointmentRow) {
  // Lieu du RDV : les RDV de la démo ne sont pas rattachés individuellement à
  // un lieu — on expose le premier site du référentiel office_places (démo
  // mono-site par défaut). C'est lui qui alimente le contrôle « mauvais
  // lieu » de la borne (id partagé avec les lieux configurés sur la borne).
  const mainPlace = listOfficePlaces()[0] ?? null;
  // Examen : le RDV démo ne stocke que le libellé — on résout l'id du
  // référentiel exams par nom (dans le bon type) pour que les conditions
  // « par examen » de la borne (messages patient, critères) matchent les ids
  // servis par GET /config/exams. Repli : id du type (comportement d'avant).
  const exam = listExams().find(
    (e) =>
      e.exam_type_id === appointment.exam_type_id &&
      e.name.toUpperCase() === appointment.exam_label.toUpperCase(),
  );
  return {
    id: encodeAppointmentId(appointment),
    patientId: String(appointment.patient_id),
    startDate: appointment.start_date,
    convocationDate: null,
    locationId: mainPlace ? String(mainPlace.id) : null,
    examId: exam ? String(exam.id) : String(appointment.exam_type_id),
    examTypeId: String(appointment.exam_type_id),
    examLabel: appointment.exam_label,
    locationLabel: mainPlace?.name ?? null,
    practitionerId: String(appointment.practitioner_id),
    roomId: appointment.room_id != null ? String(appointment.room_id) : null,
    status: appointment.status,
    prescriber: appointment.prescriber_name
      ? {
          name: appointment.prescriber_name,
          rppsId: appointment.prescriber_rpps_id,
        }
      : null,
    ticketNumber: appointment.ticket_number,
    ticketNumberFormatted: appointment.ticket_number_formatted,
    managementPageUrl: null,
    preparatorySurveyCompleted:
      appointment.preparatory_survey_completed == null
        ? null
        : appointment.preparatory_survey_completed === 1,
    vendorData: { sqliteAppointmentId: appointment.id },
  };
}

export function toContractDocument(document: DocumentRow) {
  const pages = JSON.parse(document.pages_json) as {
    contentBase64: string;
    mimeType: string;
  }[];
  return {
    id: String(document.id),
    documentType: document.document_type,
    label: document.label,
    pageCount: pages.length,
    createdAt: document.created_at,
  };
}
