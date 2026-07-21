/**
 * Internal UI API: preparatory-survey state of an appointment.
 * Three states, mirroring the contract's nullable `preparatorySurveyCompleted`:
 * null = no survey expected, false = expected but not filled, true = filled.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAppointment, setAppointmentPreparatorySurvey } from "@/server/db/repositories";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const appointment = getAppointment(Number(id));
  if (!appointment) {
    return NextResponse.json({ message: "appointment not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as {
    completed?: boolean | null;
  } | null;
  if (!body || (body.completed !== null && typeof body.completed !== "boolean")) {
    return NextResponse.json({ message: "completed must be a boolean or null" }, { status: 400 });
  }
  setAppointmentPreparatorySurvey(appointment.id, body.completed ?? null);
  return NextResponse.json({ ok: true, completed: body.completed ?? null });
}
