/**
 * Internal UI API: documents of an appointment (agenda's Documents dialog).
 *
 * GET  → attached documents (with page previews as data URIs) + the required
 *        document types of the appointment.
 * POST → manually attach a document (receptionist side). Pages are optional:
 *        without a scan the demo stores a 1×1 placeholder page — what matters
 *        for the check-in conditions is that a document OF THAT TYPE exists
 *        (same rule the kiosk applies through the contract).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  createDocument,
  documentTypeLabelOf,
  getAppointment,
  listDocuments,
  requiredDocumentTypesOf,
} from "@/server/db/repositories";
import type { DocumentRow } from "@/server/db/types";

/** 1×1 transparent PNG — placeholder page for documents added without a file. */
const PLACEHOLDER_PAGE = {
  contentBase64:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  mimeType: "image/png",
};

function toUiDocument(document: DocumentRow) {
  const pages = JSON.parse(document.pages_json) as { contentBase64: string; mimeType: string }[];
  return {
    id: document.id,
    documentType: document.document_type,
    label: document.label ?? documentTypeLabelOf(document.document_type),
    createdAt: document.created_at,
    pageCount: pages.length,
    pages: pages.map((page) => `data:${page.mimeType};base64,${page.contentBase64}`),
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const appointment = getAppointment(Number(id));
  if (!appointment) {
    return NextResponse.json({ message: "appointment not found" }, { status: 404 });
  }
  return NextResponse.json({
    documents: listDocuments(appointment.id).map(toUiDocument),
    requiredDocumentTypes: requiredDocumentTypesOf(appointment),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const appointment = getAppointment(Number(id));
  if (!appointment) {
    return NextResponse.json({ message: "appointment not found" }, { status: 404 });
  }
  const body = (await request.json().catch(() => null)) as {
    documentType?: string;
    label?: string;
    pages?: { contentBase64?: string; mimeType?: string }[];
  } | null;
  if (!body?.documentType) {
    return NextResponse.json({ message: "documentType is required" }, { status: 400 });
  }
  const pages =
    Array.isArray(body.pages) && body.pages.length > 0
      ? body.pages.filter((p) => p.contentBase64 && p.mimeType)
      : [PLACEHOLDER_PAGE];
  const document = createDocument({
    appointmentId: appointment.id,
    documentType: body.documentType,
    label: body.label ?? documentTypeLabelOf(body.documentType),
    rotationAngle: 0,
    pages: pages as { contentBase64: string; mimeType: string }[],
  });
  return NextResponse.json({ document: toUiDocument(document) }, { status: 201 });
}
