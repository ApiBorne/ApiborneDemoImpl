/**
 * Internal UI API: edit / delete a patient from the /patients page. Pure demo
 * tooling — the kiosk-side updates go through the contract's
 * PATCH /apiborneIntegrationService/v1/patients/{patientId}.
 */
import { NextResponse, type NextRequest } from "next/server";
import { deletePatient, getPatient, patchPatient } from "@/server/db/repositories";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const body = (await request.json().catch(() => null)) as {
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    socialSecurityId?: string | null;
    email?: string | null;
    mobilePhone?: string | null;
  } | null;
  if (!id || !body) {
    return NextResponse.json({ message: "invalid request" }, { status: 400 });
  }
  if (!getPatient(id)) {
    return NextResponse.json({ message: `patient ${id} not found` }, { status: 404 });
  }
  // Whitelist of UI-editable fields; patchPatient applies PATCH semantics
  // (absent = unchanged, null = cleared).
  const fields: Record<string, unknown> = {};
  for (const key of [
    "firstName",
    "lastName",
    "birthDate",
    "socialSecurityId",
    "email",
    "mobilePhone",
  ] as const) {
    if (key in body) {
      fields[key] = body[key];
    }
  }
  patchPatient(id, fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ message: "invalid request" }, { status: 400 });
  }
  if (!deletePatient(id)) {
    return NextResponse.json({ message: `patient ${id} not found` }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
