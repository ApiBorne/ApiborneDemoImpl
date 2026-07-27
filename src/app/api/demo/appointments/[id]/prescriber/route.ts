/**
 * Internal UI API: set or clear the prescriber of an appointment from the
 * agenda dialog. The kiosk sets the same fields through the contract route
 * PUT /appointments/{appointmentId}/prescriber (setAppointmentPrescriber) —
 * typically after the patient validates a proposal from a prescription upload.
 * Feeds the kiosk's "check-in only if the prescriber is set" condition.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAppointment, setAppointmentPrescriber } from "@/server/db/repositories";

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
    prescriber?: { name?: string; rppsId?: string | null } | null;
  } | null;
  if (body === null || body.prescriber === undefined) {
    return NextResponse.json(
      { message: "prescriber is required ({ name, rppsId? } or null to clear)" },
      { status: 400 },
    );
  }
  if (body.prescriber === null) {
    setAppointmentPrescriber(appointment.id, null, null);
    return NextResponse.json({ ok: true, prescriber: null });
  }
  const name = String(body.prescriber.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ message: "prescriber.name is required" }, { status: 400 });
  }
  const rppsId = String(body.prescriber.rppsId ?? "").trim() || null;
  setAppointmentPrescriber(appointment.id, name, rppsId);
  return NextResponse.json({ ok: true, prescriber: { name, rppsId } });
}
