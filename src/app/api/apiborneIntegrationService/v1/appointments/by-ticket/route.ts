/**
 * POST /appointments/by-ticket — operationId `getAppointmentByTicket`
 *
 * Identification patient par NUMÉRO DE TICKET (émis au check-in) + DATE DE
 * NAISSANCE. C'est le parcours de l'app patient « Pass » : le patient saisit le
 * numéro imprimé sur son ticket et sa date de naissance. L'éditeur résout le RDV
 * du jour portant ce ticket, puis VÉRIFIE la naissance (garde d'accès patient),
 * et renvoie la même forme que `by-code` (AppointmentDetail).
 *
 * Ticket accepté au format brut (`2`) ou formaté (`RA-2`). Aucun RDV / naissance
 * KO → 404 UNKNOWN_APPOINTMENT (le kiosk affiche son propre message).
 */
import type { NextRequest } from "next/server";
import { requireKioskAuth } from "@/server/contract/auth";
import { withContractCrypto } from "@/server/contract/encryption";
import { contractError, ok, withErrorBoundary } from "@/server/contract/errors";
import { dayWindowOf, toAppointmentDetail } from "@/server/contract/resolve";
import {
  getAppointmentByTicketOnDay,
  getPatient,
} from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const POST = withErrorBoundary(
  withContractCrypto(async (request: NextRequest) => {
    const authError = requireKioskAuth(request);
    if (authError) return authError;

    const body = (await request.json().catch(() => null)) as {
      ticketNumber?: string;
      birthDate?: string;
      officePlaceVisibleId?: string;
    } | null;
    const ticketNumber = String(body?.ticketNumber ?? "").trim();
    const birthDate = String(body?.birthDate ?? "").trim();
    const officePlaceVisibleId = String(body?.officePlaceVisibleId ?? "").trim();
    if (!ticketNumber || !birthDate || !officePlaceVisibleId) {
      return contractError(
        "VALIDATION_ERROR",
        "ticketNumber, birthDate and officePlaceVisibleId are required",
        {
          field: !ticketNumber
            ? "ticketNumber"
            : !birthDate
              ? "birthDate"
              : "officePlaceVisibleId",
        },
      );
    }
    // Cet éditeur expose l'id numérique du lieu comme visibleId (cf. config/office-places).
    const officePlaceId = Number(officePlaceVisibleId);
    if (!Number.isInteger(officePlaceId)) {
      return contractError("VALIDATION_ERROR", "officePlaceVisibleId is invalid", {
        field: "officePlaceVisibleId",
      });
    }

    const { start, end } = dayWindowOf(new Date());
    const appointment = getAppointmentByTicketOnDay(
      ticketNumber,
      officePlaceId,
      start,
      end,
    );
    if (!appointment) {
      return contractError(
        "UNKNOWN_APPOINTMENT",
        `No appointment for ticket '${ticketNumber}' today`,
      );
    }
    // Garde d'accès : la naissance saisie (ISO YYYY-MM-DD) doit matcher le patient.
    const patient = getPatient(appointment.patient_id);
    if (!patient || patient.birth_date.slice(0, 10) !== birthDate.slice(0, 10)) {
      return contractError(
        "UNKNOWN_APPOINTMENT",
        "Ticket and birth date do not match",
      );
    }
    return ok(toAppointmentDetail(appointment));
  }),
);
