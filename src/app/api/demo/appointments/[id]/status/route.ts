/**
 * Internal UI API: status change from an agenda card.
 *
 * This is the receptionist path — it delegates to
 * `changeAppointmentStatus` (src/server/demo/actions.ts), which is where the
 * editor ↔ ApiBorne server interactions live (ticket issuance on arrival,
 * status push on every change).
 */
import { NextResponse, type NextRequest } from "next/server";
import { changeAppointmentStatus } from "@/server/demo/actions";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/server/db/types";
import { toUiAppointment } from "../../route";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { status?: string } | null;
  const status = body?.status as AppointmentStatus | undefined;
  if (!status || !APPOINTMENT_STATUSES.includes(status)) {
    return NextResponse.json({ message: "invalid status" }, { status: 400 });
  }
  const updated = await changeAppointmentStatus(Number(id), status);
  if (!updated) {
    return NextResponse.json({ message: "appointment not found" }, { status: 404 });
  }
  return NextResponse.json({ appointment: toUiAppointment(updated) });
}
