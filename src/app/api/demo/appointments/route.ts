/**
 * Internal UI API: agenda appointments — list of a day (enriched for display)
 * and creation from the agenda dialog.
 */
import { NextResponse, type NextRequest } from "next/server";
import { dayWindowOf } from "@/server/contract/resolve";
import {
  createAppointment,
  getExamType,
  getPatient,
  listAppointmentsOfDay,
  listDocuments,
  requiredDocumentTypesOf,
} from "@/server/db/repositories";
import type { AppointmentRow } from "@/server/db/types";

export function toUiAppointment(a: AppointmentRow) {
  const patient = getPatient(a.patient_id);
  const requiredDocumentTypes = requiredDocumentTypesOf(a);
  const providedTypes = new Set(listDocuments(a.id).map((d) => d.document_type));
  return {
    id: a.id,
    visibleId: a.visible_id,
    patientId: a.patient_id,
    patientName: patient ? `${patient.first_name} ${patient.last_name}` : "?",
    practitionerId: a.practitioner_id,
    roomId: a.room_id,
    officePlaceId: a.office_place_id,
    examTypeId: a.exam_type_id,
    examLabel: a.exam_label,
    startDate: a.start_date,
    durationMinutes: a.duration_minutes,
    status: a.status,
    ticketNumberFormatted: a.ticket_number_formatted,
    anomalyCodes: a.anomaly_codes ? (JSON.parse(a.anomaly_codes) as string[]) : [],
    prescriberName: a.prescriber_name,
    prescriberRppsId: a.prescriber_rpps_id,
    requiredDocumentTypes,
    missingDocumentTypes: requiredDocumentTypes.filter((t) => !providedTypes.has(t)),
    preparatorySurveyCompleted:
      a.preparatory_survey_completed == null ? null : a.preparatory_survey_completed === 1,
    checkinDocumentsComplete:
      a.checkin_documents_complete == null ? null : a.checkin_documents_complete === 1,
  };
}

export function GET(request: NextRequest): NextResponse {
  const dateParam = request.nextUrl.searchParams.get("date");
  const date = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date();
  const { start, end } = dayWindowOf(date);
  return NextResponse.json({
    appointments: listAppointmentsOfDay(start, end).map(toUiAppointment),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    patientId?: number;
    practitionerId?: number;
    roomId?: number | null;
    officePlaceId?: number | null;
    examTypeId?: number;
    examLabel?: string;
    startDate?: string;
    durationMinutes?: number;
  } | null;
  if (!body?.patientId || !body?.practitionerId || !body?.examTypeId || !body?.startDate) {
    return NextResponse.json(
      { message: "patientId, practitionerId, examTypeId and startDate are required" },
      { status: 400 },
    );
  }
  const examType = getExamType(body.examTypeId);
  const appointment = createAppointment({
    patientId: body.patientId,
    practitionerId: body.practitionerId,
    roomId: body.roomId ?? null,
    officePlaceId: body.officePlaceId ?? null,
    examTypeId: body.examTypeId,
    examLabel: body.examLabel || examType?.name || "EXAM",
    startDate: body.startDate,
    durationMinutes: body.durationMinutes ?? 20,
  });
  return NextResponse.json({ appointment: toUiAppointment(appointment) }, { status: 201 });
}
