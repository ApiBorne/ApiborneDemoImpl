/**
 * POST /patients/identify — operationId `identifyPatients`
 *
 * The kiosk's first call: find patients from identity criteria and return
 * each match with its appointments OF THE DAY. Contract rules implemented
 * here (contract/openapi.yaml + README "identify"):
 *  - ALL provided criteria are COMBINED (the contract mandates it) — the NIR
 *    alone would be ambiguous on a family Vitale card (shared by every
 *    beneficiary); it MUST tolerate spaces;
 *  - if `context.config.identification.twoFieldsIdentification` is true and
 *    the strict search finds NOTHING, the editor MUST retry the two-field
 *    crossed searches (lastName+birthDate, firstName+birthDate,
 *    lastName+firstName) — kiosk feature « Identifier le patient avec 2
 *    champs parmi 3 »;
 *  - no match → 200 { patients: [] } (NOT an error);
 *  - a patient without appointments today → appointments: [];
 *  - result capped (~10 patients) — enforced in the repository.
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { withContractCrypto } from "@/server/contract/encryption";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import {
  toContractAppointment,
  toContractPatient,
} from "@/server/contract/mappers";
import { dayWindowOf } from "@/server/contract/resolve";
import {
  listAppointmentsOfPatientOnDay,
  searchPatients,
} from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const POST = withErrorBoundary(
  withContractCrypto(async (request: NextRequest) => {
    const authError = requireKioskAuth(request);
    if (authError) return authError;

    const body = (await request.json().catch(() => null)) as {
      context?: {
        config?: { identification?: { twoFieldsIdentification?: boolean } };
      };
      criteria?: {
        socialSecurityId?: string;
        lastName?: string;
        firstName?: string;
        birthDate?: string;
      };
    } | null;
    if (!body?.criteria) {
      return contractError("VALIDATION_ERROR", "criteria is required", {
        field: "criteria",
      });
    }

    const { criteria } = body;
    const lastName = criteria.lastName ?? null;
    const firstName = criteria.firstName ?? null;
    const birthDate = criteria.birthDate ?? null;
    let patients = searchPatients({
      // NIR: digits only — the contract requires tolerating spaces.
      socialSecurityId: criteria.socialSecurityId
        ? criteria.socialSecurityId.replace(/\s+/g, "")
        : null,
      lastName,
      firstName,
      birthDate,
    });

    // Two-field fallback (contract): only when the strict search found
    // nothing, and only over pairs whose BOTH fields were provided. Results
    // of the pairs are merged (dedup by id) and capped like the strict path.
    const twoFieldsIdentification =
      body.context?.config?.identification?.twoFieldsIdentification === true;
    if (patients.length === 0 && twoFieldsIdentification) {
      const pairs = [
        { lastName, birthDate },
        { firstName, birthDate },
        { lastName, firstName },
      ].filter((pair) => Object.values(pair).every((value) => value != null && value !== ""));
      const seen = new Set<number>();
      for (const pair of pairs) {
        for (const patient of searchPatients(pair)) {
          if (!seen.has(patient.id)) {
            seen.add(patient.id);
            patients.push(patient);
          }
        }
      }
      patients = patients.slice(0, 10);
    }

    const { start, end } = dayWindowOf(new Date());
    return ok({
      patients: patients.map((patient) => ({
        patient: toContractPatient(patient),
        appointments: listAppointmentsOfPatientOnDay(
          patient.id,
          start,
          end,
        ).map(toContractAppointment),
      })),
    });
  }),
);
