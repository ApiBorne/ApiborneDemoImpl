/**
 * Internal UI API: cancel the ticket of an appointment so the patient can
 * redo the whole kiosk check-in (delegates to cancelAppointmentTicket —
 * local reset + ApiBorne ticket cancellation + status push).
 */
import { NextResponse, type NextRequest } from "next/server";
import { cancelAppointmentTicket } from "@/server/demo/actions";
import { toUiAppointment } from "../../route";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const updated = await cancelAppointmentTicket(Number(id));
  if (!updated) {
    return NextResponse.json({ message: "appointment not found" }, { status: 404 });
  }
  return NextResponse.json({ appointment: toUiAppointment(updated) });
}
