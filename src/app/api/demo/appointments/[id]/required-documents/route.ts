/**
 * Internal UI API: replace the required document types of an appointment
 * ("this appointment needs a prescription + an MRI questionnaire"). Served to
 * the kiosk as `requiredDocumentTypes` by the contract's documents route.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getAppointment, setAppointmentRequiredDocumentTypes } from "@/server/db/repositories";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const appointment = getAppointment(Number(id));
  if (!appointment) {
    return NextResponse.json({ message: "appointment not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as { types?: string[] } | null;
  if (!body || !Array.isArray(body.types) || body.types.some((t) => typeof t !== "string")) {
    return NextResponse.json({ message: "types must be an array of strings" }, { status: 400 });
  }
  setAppointmentRequiredDocumentTypes(appointment.id, body.types);
  return NextResponse.json({ ok: true, types: body.types });
}
