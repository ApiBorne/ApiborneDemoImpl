/**
 * POST /patients/identify — operationId `identifyPatients`
 *
 * The kiosk's first call: find patients from identity criteria and return
 * each match with its appointments OF THE DAY. Contract rules implemented
 * here (contract/openapi.yaml + README "identify"):
 *  - ALL provided criteria are COMBINED (the contract mandates it) — the NIR
 *    alone would be ambiguous on a family Vitale card (shared by every
 *    beneficiary); it MUST tolerate spaces;
 *  - no match → 200 { patients: [] } (NOT an error);
 *  - a patient without appointments today → appointments: [];
 *  - result capped (~10 patients) — enforced in the repository.
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import { toContractAppointment, toContractPatient } from "@/server/contract/mappers";
import { dayWindowOf } from "@/server/contract/resolve";
import { listAppointmentsOfPatientOnDay, searchPatients } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const POST = withErrorBoundary(async (request: NextRequest) => {
  const authError = requireKioskAuth(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => null)) as {
    criteria?: {
      socialSecurityId?: string;
      lastName?: string;
      firstName?: string;
      birthDate?: string;
    };
  } | null;
  if (!body?.criteria) {
    return contractError("VALIDATION_ERROR", "criteria is required", { field: "criteria" });
  }

  const { criteria } = body;
  const patients = searchPatients({
    // NIR: digits only — the contract requires tolerating spaces.
    socialSecurityId: criteria.socialSecurityId
      ? criteria.socialSecurityId.replace(/\s+/g, "")
      : null,
    lastName: criteria.lastName ?? null,
    firstName: criteria.firstName ?? null,
    birthDate: criteria.birthDate ?? null,
  });

  const { start, end } = dayWindowOf(new Date());
  return ok({
    patients: patients.map((patient) => ({
      patient: toContractPatient(patient),
      appointments: listAppointmentsOfPatientOnDay(patient.id, start, end).map(
        toContractAppointment,
      ),
    })),
  });
});
