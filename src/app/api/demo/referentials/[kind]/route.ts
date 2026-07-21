/**
 * Internal UI API: referential management (create) — /referentials page.
 * kind ∈ practitioners | rooms | examTypes | exams. Not part of the contract.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  createDocumentType,
  createExam,
  createExamType,
  createOfficePlace,
  createPractitioner,
  createRoom,
} from "@/server/db/repositories";

type Kind =
  | "practitioners"
  | "rooms"
  | "examTypes"
  | "exams"
  | "officePlaces"
  | "documentTypes";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ kind: string }> },
): Promise<NextResponse> {
  const { kind } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ message: "invalid body" }, { status: 400 });
  }
  switch (kind as Kind) {
    case "practitioners": {
      const fullName = String(body.fullName ?? "").trim();
      if (!fullName) {
        return NextResponse.json({ message: "fullName is required" }, { status: 400 });
      }
      const row = createPractitioner({
        fullName,
        rppsId: body.rppsId ? String(body.rppsId) : null,
        color: String(body.color ?? "#6366f1"),
      });
      return NextResponse.json({ id: row.id }, { status: 201 });
    }
    case "rooms": {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json({ message: "name is required" }, { status: 400 });
      }
      const row = createRoom({ name });
      return NextResponse.json({ id: row.id }, { status: 201 });
    }
    case "officePlaces": {
      const name = String(body.name ?? "").trim();
      if (!name) {
        return NextResponse.json({ message: "name is required" }, { status: 400 });
      }
      const row = createOfficePlace({ name });
      return NextResponse.json({ id: row.id }, { status: 201 });
    }
    case "examTypes": {
      const name = String(body.name ?? "").trim();
      const ticketPrefix = String(body.ticketPrefix ?? "").trim();
      if (!name || !ticketPrefix) {
        return NextResponse.json({ message: "name and ticketPrefix are required" }, { status: 400 });
      }
      const row = createExamType({ name, ticketPrefix });
      return NextResponse.json({ id: row.id }, { status: 201 });
    }
    case "exams": {
      const name = String(body.name ?? "").trim();
      const examTypeId = Number(body.examTypeId);
      if (!name || !examTypeId) {
        return NextResponse.json({ message: "name and examTypeId are required" }, { status: 400 });
      }
      const row = createExam({ name, examTypeId });
      return NextResponse.json({ id: row.id }, { status: 201 });
    }
    case "documentTypes": {
      const code = String(body.code ?? "").trim();
      const label = String(body.label ?? "").trim();
      if (!code || !label) {
        return NextResponse.json({ message: "code and label are required" }, { status: 400 });
      }
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(code)) {
        return NextResponse.json(
          { message: "code must match ^[A-Za-z][A-Za-z0-9_-]*$ (contract documentType)" },
          { status: 400 },
        );
      }
      const row = createDocumentType({ code, label });
      return NextResponse.json({ id: row.id }, { status: 201 });
    }
    default:
      return NextResponse.json({ message: `unknown referential '${kind}'` }, { status: 404 });
  }
}
