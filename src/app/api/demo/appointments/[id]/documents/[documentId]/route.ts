/** Internal UI API: delete a document attached to an appointment. */
import { NextResponse, type NextRequest } from "next/server";
import { deleteDocument, getAppointment, getDocument } from "@/server/db/repositories";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; documentId: string }> },
): Promise<NextResponse> {
  const { id, documentId } = await context.params;
  const appointment = getAppointment(Number(id));
  const document = getDocument(Number(documentId));
  if (!appointment || !document || document.appointment_id !== appointment.id) {
    return NextResponse.json({ message: "document not found" }, { status: 404 });
  }
  deleteDocument(document.id);
  return NextResponse.json({ ok: true });
}
