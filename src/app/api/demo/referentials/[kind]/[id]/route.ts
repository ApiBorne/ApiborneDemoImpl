/**
 * Internal UI API: referential management (update / delete) — /referentials
 * page. Deletes are guarded in the repositories (rows referenced by
 * appointments cannot be removed); the guard message comes back as a 409.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  deleteDocumentType,
  deleteExam,
  deleteExamType,
  deleteOfficePlace,
  deletePractitioner,
  deleteRoom,
  updateDocumentType,
  updateExam,
  updateExamType,
  updateOfficePlace,
  updatePractitioner,
  updateRoom,
} from "@/server/db/repositories";

type Kind =
  | "practitioners"
  | "rooms"
  | "examTypes"
  | "exams"
  | "officePlaces"
  | "documentTypes";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
): Promise<NextResponse> {
  const { kind, id: idParam } = await params;
  const id = Number(idParam);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!id || !body) {
    return NextResponse.json({ message: "invalid request" }, { status: 400 });
  }
  switch (kind as Kind) {
    case "practitioners":
      updatePractitioner(id, {
        fullName: String(body.fullName ?? "").trim(),
        rppsId: body.rppsId ? String(body.rppsId) : null,
        color: String(body.color ?? "#6366f1"),
      });
      break;
    case "rooms":
      updateRoom(id, { name: String(body.name ?? "").trim() });
      break;
    case "officePlaces":
      updateOfficePlace(id, { name: String(body.name ?? "").trim() });
      break;
    case "examTypes":
      updateExamType(id, {
        name: String(body.name ?? "").trim(),
        ticketPrefix: String(body.ticketPrefix ?? "").trim(),
      });
      break;
    case "exams":
      updateExam(id, { name: String(body.name ?? "").trim(), examTypeId: Number(body.examTypeId) });
      break;
    case "documentTypes":
      updateDocumentType(id, {
        code: String(body.code ?? "").trim(),
        label: String(body.label ?? "").trim(),
      });
      break;
    default:
      return NextResponse.json({ message: `unknown referential '${kind}'` }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
): Promise<NextResponse> {
  const { kind, id: idParam } = await params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ message: "invalid id" }, { status: 400 });
  }
  const guards: Record<Kind, (id: number) => string | null> = {
    practitioners: deletePractitioner,
    rooms: deleteRoom,
    examTypes: deleteExamType,
    exams: deleteExam,
    officePlaces: deleteOfficePlace,
    documentTypes: deleteDocumentType,
  };
  const remove = guards[kind as Kind];
  if (!remove) {
    return NextResponse.json({ message: `unknown referential '${kind}'` }, { status: 404 });
  }
  const refused = remove(id);
  if (refused) {
    return NextResponse.json({ message: refused }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
