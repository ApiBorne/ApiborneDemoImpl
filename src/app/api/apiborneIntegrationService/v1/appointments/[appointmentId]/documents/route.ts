/**
 * GET  /appointments/{appointmentId}/documents — operationId `listAppointmentDocuments`
 * POST /appointments/{appointmentId}/documents — operationId `uploadAppointmentDocument`
 * (OPTIONAL routes — the "documents" group of the supported-routes declaration)
 *
 * Contract semantics implemented here:
 *  - `documentType` is the vendor-neutral string enum of contract/document-types.md;
 *  - upload pages are base64 WITHOUT the `data:` prefix (JPEG/PNG), the kiosk
 *    may send several pages; replacement = DELETE then POST;
 *  - the editor MUST accept at least 10 MB per request → this demo caps at
 *    15 MB of base64 and answers 413 UPLOAD_TOO_LARGE beyond;
 *  - `analysis.prescriberProposals` is optional: this demo fakes one for
 *    `prescription` uploads (a real editor would run OCR here);
 *  - `requiredDocumentTypes` tells the kiosk which types are expected for
 *    this appointment — per-appointment (editable in the agenda's Documents
 *    dialog), falling back to a prescription for every exam. Served as
 *    { documentType, label } objects per the contract schema.
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { withContractCrypto } from "@/server/contract/encryption";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import { toContractDocument } from "@/server/contract/mappers";
import { resolveAppointment } from "@/server/contract/resolve";
import {
  createDocument,
  documentTypeLabelOf,
  listDocuments,
  listPractitioners,
  requiredDocumentTypesOf,
} from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

/** 15 MB of base64 — comfortably above the 10 MB contract minimum. */
const MAX_UPLOAD_BASE64_TOTAL_LENGTH = 15 * 1024 * 1024;

export const GET = withErrorBoundary(
  withContractCrypto(
    async (
      request: NextRequest,
      context: { params: Promise<{ appointmentId: string }> },
    ) => {
      const authError = requireKioskAuth(request);
      if (authError) return authError;

      const { appointmentId } = await context.params;
      const appointment = resolveAppointment(appointmentId);
      if (!appointment) {
        return contractError(
          "UNKNOWN_APPOINTMENT",
          `Appointment '${appointmentId}' not found`,
        );
      }

      return ok({
        documents: listDocuments(appointment.id).map(toContractDocument),
        requiredDocumentTypes: requiredDocumentTypesOf(appointment).map(
          (documentType) => ({
            documentType,
            label: documentTypeLabelOf(documentType),
          }),
        ),
      });
    },
  ),
);

export const POST = withErrorBoundary(
  withContractCrypto(
    async (
      request: NextRequest,
      context: { params: Promise<{ appointmentId: string }> },
    ) => {
      const authError = requireKioskAuth(request);
      if (authError) return authError;

      const { appointmentId } = await context.params;
      const appointment = resolveAppointment(appointmentId);
      if (!appointment) {
        return contractError(
          "UNKNOWN_APPOINTMENT",
          `Appointment '${appointmentId}' not found`,
        );
      }

      const body = (await request.json().catch(() => null)) as {
        documentType?: string;
        label?: string;
        rotationAngle?: number;
        pages?: { contentBase64?: string; mimeType?: string }[];
      } | null;
      if (!body?.documentType) {
        return contractError("VALIDATION_ERROR", "documentType is required", {
          field: "documentType",
        });
      }
      const pages = Array.isArray(body.pages) ? body.pages : [];
      if (
        pages.length === 0 ||
        pages.some((p) => !p.contentBase64 || !p.mimeType)
      ) {
        return contractError(
          "VALIDATION_ERROR",
          "pages must be a non-empty array of { contentBase64, mimeType }",
          { field: "pages" },
        );
      }
      const totalBase64Length = pages.reduce(
        (sum, p) => sum + (p.contentBase64?.length ?? 0),
        0,
      );
      if (totalBase64Length > MAX_UPLOAD_BASE64_TOTAL_LENGTH) {
        return contractError(
          "UPLOAD_TOO_LARGE",
          `Upload exceeds ${MAX_UPLOAD_BASE64_TOTAL_LENGTH} base64 chars`,
        );
      }

      const document = createDocument({
        appointmentId: appointment.id,
        documentType: body.documentType,
        label: body.label ?? null,
        rotationAngle: body.rotationAngle ?? 0,
        pages: pages as { contentBase64: string; mimeType: string }[],
      });

      // Fake prescription analysis: a real editor would OCR the pages. Proposing
      // known practitioners exercises the kiosk's prescriber-picker flow.
      const analysis =
        body.documentType === "prescription"
          ? {
              prescriberProposals: listPractitioners()
                .slice(0, 2)
                .map((p) => ({ name: p.full_name, rppsId: p.rpps_id })),
            }
          : undefined;

      return ok(
        { documentId: String(document.id), ...(analysis ? { analysis } : {}) },
        201,
      );
    },
  ),
);
