/**
 * Outbound client to the ApiBorne NestJS server — the two best-effort
 * notifications an editor emits when the kiosk configuration is managed by
 * the ApiBorne middleware (EasyDoct flag `UseExternalConfiguration`):
 *
 *  1. POST /api/kioskTicket/issueForAppointment
 *     When an arrival is marked IN THE EDITOR'S AGENDA (not through the
 *     kiosk), the editor asks ApiBorne for the ticket number so the sequence
 *     stays SHARED with kiosk check-ins. The returned number/formattedNumber
 *     are adopted as the appointment's call ticket. `requestUid` must be
 *     UNIQUE PER GENERATION: cancelling the arrival then re-marking it must
 *     consume a NEW number (idempotency only protects a network replay of
 *     the very same call).
 *
 *  2. POST /api/kioskTicket/appointmentStatusChanged
 *     On EVERY appointment status change, so the ApiBorne server updates its
 *     tickets (`externalStatus`) and pushes the realtime event to the
 *     Cockpit — the counterpart of EasyDoct's
 *     AppointmentBoardStateManagementUtil.UpdateKioskReactorState rewrite.
 *
 * Wire conventions (mirroring EasyDoct's ApiBorneServerClient.cs):
 *  - header `Authorization` = the RAW brand authorization key (no "Bearer");
 *  - `licenceUuid` (copied from the ApiBorne admin, Connectivity page)
 *    identifies the target licence UNAMBIGUOUSLY — several licences can share
 *    the same KioskReactor brand, so brandId alone is not enough. The office
 *    identity stays in the payload as the compat fallback;
 *  - contractAppointmentId = "{id}~{visibleId}" (see mappers.ts);
 *  - 8s timeout, never blocking: failures are logged and swallowed.
 */
import crypto from "node:crypto";
import { getSetting } from "@/server/db/repositories";
import { encodeAppointmentId } from "@/server/contract/mappers";
import type { AppointmentRow, AppointmentStatus } from "@/server/db/types";

const TIMEOUT_MS = 8000;

function pushEnabled(): boolean {
  return getSetting("pushEnabled") !== "false";
}

function basePayload(): Record<string, unknown> | null {
  const baseUrl = getSetting("apiborneServerBaseUrl");
  if (!baseUrl) {
    return null;
  }
  // Identification de la licence cible : le licenceUuid (admin ApiBorne)
  // suffit et est non ambigu ; brandId/office (seedés) sont le fallback legacy
  // quand aucun UUID n'est configuré — jamais ENVOYÉS EN PLUS du UUID, car le
  // serveur vérifie tout brandId fourni (défense en profondeur) et un brandId
  // seedé obsolète ferait rejeter la notification (401 « Clé de marque
  // invalide »).
  const payload: Record<string, unknown> = {};
  const licenceUuid = getSetting("licenceUuid");
  if (licenceUuid) {
    payload.licenceUuid = licenceUuid;
    return payload;
  }
  const brandId = getSetting("brandId");
  if (!brandId) {
    return null;
  }
  payload.brandId = brandId;
  payload.officeId = getSetting("officeId");
  payload.officeVisibleId = getSetting("officeVisibleId");
  return payload;
}

async function post(path: string, payload: Record<string, unknown>): Promise<unknown | null> {
  const baseUrl = getSetting("apiborneServerBaseUrl");
  const authKey = getSetting("kioskAuthKey");
  if (!baseUrl || !authKey) {
    return null;
  }
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[apiborne] POST ${path} -> HTTP ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn(`[apiborne] POST ${path} failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Ask ApiBorne for a ticket number (agenda arrival). Returns the issued
 * ticket, or null when disabled/unreachable — the caller must then fall back
 * to LOCAL numbering so marking an arrival never fails.
 */
export async function issueTicketForAppointment(
  appointment: AppointmentRow,
  ticketPrefix: string | null,
  patientDisplayName: string | null,
): Promise<{ number: number; formattedNumber: string } | null> {
  const payload = basePayload();
  if (!payload || !pushEnabled()) {
    return null;
  }
  const contractAppointmentId = encodeAppointmentId(appointment);
  const data = (await post("/api/kioskTicket/issueForAppointment", {
    ...payload,
    // Single-site demo: the officePlaceId shared with ApiBorne is the officeId.
    officePlaceId: Number(getSetting("officeId") ?? 0),
    requestUid: `demo-ris:${contractAppointmentId}:${crypto.randomUUID()}`,
    prefix: ticketPrefix,
    contractAppointmentId,
    patientDisplayName,
    examLabel: appointment.exam_label,
  })) as { number?: number; formattedNumber?: string } | null;
  if (!data || !data.number || data.number <= 0 || !data.formattedNumber) {
    return null;
  }
  return { number: data.number, formattedNumber: data.formattedNumber };
}

/**
 * Cancel the ApiBorne tickets of the day for this appointment (the editor
 * voids the check-in so the patient can redo it at the kiosk). Cancelled
 * tickets disappear from the Cockpit; the next kiosk check-in reserves a NEW
 * number. Best-effort like every outbound call.
 */
export async function cancelTicketForAppointment(appointment: AppointmentRow): Promise<void> {
  const payload = basePayload();
  if (!payload || !pushEnabled()) {
    return;
  }
  const res = (await post("/api/kioskTicket/cancelForAppointment", {
    ...payload,
    contractAppointmentId: encodeAppointmentId(appointment),
  })) as { cancelled?: number } | null;
  if (res) {
    console.info(
      `[apiborne] ${res.cancelled ?? 0} ticket(s) cancelled for appointment ${appointment.id}`,
    );
  }
}

/** Fire-and-forget status notification. Never awaited by callers. */
export function notifyAppointmentStatusChanged(
  appointment: AppointmentRow,
  status: AppointmentStatus,
): void {
  const payload = basePayload();
  if (!payload || !pushEnabled()) {
    return;
  }
  void post("/api/kioskTicket/appointmentStatusChanged", {
    ...payload,
    contractAppointmentId: encodeAppointmentId(appointment),
    status,
  }).then((res) => {
    if (res) {
      console.info(
        `[apiborne] status '${status}' notified for appointment ${appointment.id} (${JSON.stringify(res)})`,
      );
    }
  });
}
