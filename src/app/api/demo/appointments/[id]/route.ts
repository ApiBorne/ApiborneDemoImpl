/**
 * Internal UI API: edit an appointment from the agenda dialog. Pure demo
 * tooling (patient, practitioner, room, exam, time, duration) — status
 * changes go through the dedicated /status route so the ApiBorne
 * notifications stay in one place.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAppointment, getExamType, updateAppointment } from "@/server/db/repositories";
import { toUiAppointment } from "../route";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const body = (await request.json().catch(() => null)) as {
    patientId?: number;
    practitionerId?: number;
    roomId?: number | null;
    examTypeId?: number;
    examLabel?: string;
    startDate?: string;
    durationMinutes?: number;
  } | null;
  if (!id || !body) {
    return NextResponse.json({ message: "invalid request" }, { status: 400 });
  }
  const existing = getAppointment(id);
  if (!existing) {
    return NextResponse.json({ message: `appointment ${id} not found` }, { status: 404 });
  }
  if (!body.patientId || !body.practitionerId || !body.examTypeId || !body.startDate) {
    return NextResponse.json(
      { message: "patientId, practitionerId, examTypeId and startDate are required" },
      { status: 400 },
    );
  }
  const examType = getExamType(body.examTypeId);
  const updated = updateAppointment(id, {
    patientId: body.patientId,
    practitionerId: body.practitionerId,
    roomId: body.roomId ?? null,
    examTypeId: body.examTypeId,
    examLabel: body.examLabel || examType?.name || "EXAM",
    startDate: body.startDate,
    durationMinutes: body.durationMinutes ?? existing.duration_minutes,
  });
  return NextResponse.json({ appointment: toUiAppointment(updated!) });
}
