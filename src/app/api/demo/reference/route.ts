/**
 * Internal UI API (NOT part of the contract): reference data for the agenda —
 * practitioners, rooms and exam types. Everything under /api/demo/** serves
 * the demo's own pages; a kiosk never calls these routes.
 */
import { NextResponse } from "next/server";
import {
  listDocumentTypes,
  listExams,
  listExamTypes,
  listOfficePlaces,
  listPractitioners,
  listRooms,
} from "@/server/db/repositories";

export function GET(): NextResponse {
  return NextResponse.json({
    practitioners: listPractitioners().map((p) => ({
      id: p.id,
      fullName: p.full_name,
      rppsId: p.rpps_id,
      color: p.color,
    })),
    rooms: listRooms().map((r) => ({ id: r.id, name: r.name })),
    officePlaces: listOfficePlaces().map((p) => ({ id: p.id, name: p.name })),
    examTypes: listExamTypes().map((e) => ({
      id: e.id,
      name: e.name,
      ticketPrefix: e.ticket_prefix,
    })),
    exams: listExams().map((e) => ({
      id: e.id,
      name: e.name,
      examTypeId: e.exam_type_id,
    })),
    documentTypes: listDocumentTypes().map((t) => ({
      id: t.id,
      code: t.code,
      label: t.label,
    })),
  });
}
