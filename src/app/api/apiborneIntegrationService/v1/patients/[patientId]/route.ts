/**
 * PATCH /patients/{patientId} — operationId `updatePatient` (OPTIONAL route)
 *
 * PATCH semantics per the contract: a field ABSENT from the body is left
 * unchanged; an explicit `null` clears the value. Success is `204 No Content`
 * — the kiosk then reloads the appointment for canonical data.
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { withContractCrypto } from "@/server/contract/encryption";
import {
  contractError,
  noContent,
  withErrorBoundary,
} from "@/server/contract/errors";
import { getPatient, patchPatient } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const PATCH = withErrorBoundary(
  withContractCrypto(
    async (
      request: NextRequest,
      context: { params: Promise<{ patientId: string }> },
    ) => {
      const authError = requireKioskAuth(request);
      if (authError) return authError;

      const { patientId } = await context.params;
      const id = Number(patientId);
      if (!Number.isFinite(id) || !getPatient(id)) {
        return contractError(
          "UNKNOWN_PATIENT",
          `Patient '${patientId}' not found`,
        );
      }

      const body = (await request.json().catch(() => null)) as {
        patient?: Record<string, string | null>;
      } | null;
      if (!body?.patient || typeof body.patient !== "object") {
        return contractError("VALIDATION_ERROR", "patient is required", {
          field: "patient",
        });
      }

      patchPatient(id, body.patient);
      return noContent();
    },
  ),
);
