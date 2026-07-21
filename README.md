# Demo medical management system — ApiBorne Kiosk Integration Contract reference implementation

A complete, runnable **reference implementation of the ApiBorne Kiosk
Integration Contract** from the point of view of a medical management system (RIS, EMR…) **editor**: the
system that owns patients and appointments, and that an ApiBorne check-in
kiosk talks to during the patient journey.

It is intentionally small and heavily commented so that a developer — or an
AI assistant — can read it end to end and understand exactly what an editor
must implement.

- **Stack**: Next.js (App Router) · React · TypeScript (strict) · Tailwind v4 ·
  shadcn/ui · SQLite (`better-sqlite3`, no ORM)
- **Contract spec**: [`contract/openapi.yaml`](contract/openapi.yaml) (source of
  truth, bundled) + [`contract/document-types.md`](contract/document-types.md)
- **Implementation guide**: [`docs/CONTRACT_GUIDE.md`](docs/CONTRACT_GUIDE.md)
- **Code map for AI/agents**: [`AGENTS.md`](AGENTS.md)

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — defaults work out of the box
npm run dev                  # http://localhost:3020
```

On first start a SQLite database (`data/demo.db`) is created and seeded with
fake practitioners, rooms, exam types, patients (fake identities and NIRs) and
a few appointments for today. `npm run db:reset` deletes it.

What you get:

| Page | Purpose |
|---|---|
| `/` | **Agenda** — day view (hours × practitioners). Click a slot to create an appointment, use the card menu to mark arrivals / care / done, or hit **Generate random appointments**. |
| `/patients` | The fake patient dataset (copy a NIR to exercise `POST /patients/identify`). |
| `/settings` | ApiBorne licence UUID, ApiBorne server URL, outbound-push toggle, demo-data reset. Auth key and devices are managed automatically (TOFU / auto-registration). |

## The contract, mapped to code

All 12 operations of the contract are served under
`/api/apiborneIntegrationService/v1` (the base path is imposed by the
contract). Each handler file starts with a comment explaining the semantics
it implements.

| Contract operation | operationId | Handler |
|---|---|---|
| `POST /patients/identify` | `identifyPatients` | [`src/app/api/apiborneIntegrationService/v1/patients/identify/route.ts`](src/app/api/apiborneIntegrationService/v1/patients/identify/route.ts) |
| `PATCH /patients/{patientId}` | `updatePatient` | [`.../patients/[patientId]/route.ts`](src/app/api/apiborneIntegrationService/v1/patients/%5BpatientId%5D/route.ts) |
| `GET /appointments/by-code/{code}` | `getAppointmentByCode` | [`.../appointments/by-code/[code]/route.ts`](src/app/api/apiborneIntegrationService/v1/appointments/by-code/%5Bcode%5D/route.ts) |
| `GET /appointments/{id}` | `getAppointmentById` | [`.../appointments/[appointmentId]/route.ts`](src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/route.ts) |
| `PUT /appointments/{id}/status` | `setAppointmentStatus` | [`.../[appointmentId]/status/route.ts`](src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/status/route.ts) |
| `PUT /appointments/{id}/prescriber` | `setAppointmentPrescriber` | [`.../[appointmentId]/prescriber/route.ts`](src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/prescriber/route.ts) |
| `GET`/`POST /appointments/{id}/documents` | `listAppointmentDocuments` / `uploadAppointmentDocument` | [`.../[appointmentId]/documents/route.ts`](src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/documents/route.ts) |
| `DELETE /appointments/{id}/documents/{docId}` | `deleteAppointmentDocument` | [`.../documents/[documentId]/route.ts`](src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/documents/%5BdocumentId%5D/route.ts) |
| `POST /appointments/{id}/check-in` | `checkInAppointment` | [`.../[appointmentId]/check-in/route.ts`](src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/check-in/route.ts) |
| `GET /appointments/{id}/notification-readiness` | `getNotificationReadiness` | [`.../[appointmentId]/notification-readiness/route.ts`](src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/notification-readiness/route.ts) |
| `POST /staff/sign-in` | `staffSignIn` | [`src/app/api/apiborneIntegrationService/v1/staff/sign-in/route.ts`](src/app/api/apiborneIntegrationService/v1/staff/sign-in/route.ts) |

Five extra **configuration routes** (ApiBorne extension, not part of the 12
kiosk operations) expose the editor's reference data to the ApiBorne server —
which also probes them to validate the integration before unlocking the rest
of its admin configuration. Auth-key-only (server-to-server). The data behind
them is editable in the demo's `/referentials` page:

| Configuration route | Handler |
|---|---|
| `GET /config/office-places` → `{ officePlaces: [{ id, name }] }` | [`.../config/office-places/route.ts`](src/app/api/apiborneIntegrationService/v1/config/office-places/route.ts) |
| `GET /config/exam-types` → `{ examTypes: [{ id, name, ticketPrefix }] }` | [`.../config/exam-types/route.ts`](src/app/api/apiborneIntegrationService/v1/config/exam-types/route.ts) |
| `GET /config/practitioners` → `{ practitioners: [{ id, name, rppsId }] }` | [`.../config/practitioners/route.ts`](src/app/api/apiborneIntegrationService/v1/config/practitioners/route.ts) |
| `GET /config/rooms` → `{ rooms: [{ id, name }] }` | [`.../config/rooms/route.ts`](src/app/api/apiborneIntegrationService/v1/config/rooms/route.ts) |
| `GET /config/exams` → `{ exams: [{ id, name, examTypeId }] }` | [`.../config/exams/route.ts`](src/app/api/apiborneIntegrationService/v1/config/exams/route.ts) |

Shared building blocks (read these first):

- [`src/server/contract/auth.ts`](src/server/contract/auth.ts) — the two-header
  authentication (`X-Kiosk-Auth-Key`, `X-Kiosk-Device-Id`), validation order,
  and the auth-key-only exception for server-to-server calls.
- [`src/server/contract/errors.ts`](src/server/contract/errors.ts) — the
  normalized error body `{ error: { code, message, details } }` with real HTTP
  status codes.
- [`src/server/contract/cors.ts`](src/server/contract/cors.ts) — mandatory CORS
  (the kiosk is a browser app).
- [`src/server/contract/mappers.ts`](src/server/contract/mappers.ts) — SQLite
  rows → contract DTOs, the `{id}~{visibleId}` appointment-id convention and
  the `vendorData` round-trip.

### Mandatory vs optional routes

The ApiBorne integration settings let an editor declare which **optional**
routes it supports; the kiosk and the ApiBorne server degrade gracefully when
one is missing (the editor may also answer `501 NOT_SUPPORTED`):

- **Mandatory** (the minimal patient journey): `identifyPatients`,
  `getAppointmentByCode`, `getAppointmentById`, `checkInAppointment`,
  `getNotificationReadiness`.
- **Optional**: `updatePatient`, `setAppointmentPrescriber`, the `documents`
  group (list/upload/delete), `setAppointmentStatus` (Cockpit),
  `staffSignIn` (Cockpit).

**This demo implements all of them.**

## Outbound calls to the ApiBorne server

An editor whose kiosk configuration is managed by the ApiBorne middleware
also emits two **best-effort** notifications (see
[`src/server/apiborne/client.ts`](src/server/apiborne/client.ts) and
[`src/server/demo/actions.ts`](src/server/demo/actions.ts)):

1. **`POST /api/kioskTicket/issueForAppointment`** — when a receptionist marks
   an arrival **in the agenda** (not through the kiosk), the ticket number is
   requested from ApiBorne so agenda arrivals and kiosk check-ins share **one
   sequence**. Falls back to local numbering if the server is unreachable.
2. **`POST /api/kioskTicket/appointmentStatusChanged`** — on **every** status
   change, so the ApiBorne Cockpit reflects the agenda in near real time.

Both use the raw auth key in the `Authorization` header and carry the
`licenceUuid` (unambiguous licence identifier from the ApiBorne admin —
several licences can share one brand) plus the office identity as fallback in
the payload. Symmetrically, the ApiBorne Cockpit writes back into this demo
through `PUT /appointments/{id}/status` and `POST /staff/sign-in`.

## Connecting a real ApiBorne kiosk

Zero-configuration by default — the shared secrets already live in the
ApiBorne admin, so the demo learns them instead of duplicating them:

- the **auth key** (`brandAuthorizationKey`) is captured from the first
  contract call (trust-on-first-use) — reset the demo data to forget it, or
  pin it via `SEED_KIOSK_AUTH_KEY` / `PUT /api/demo/settings`;
- **unknown devices** presenting a valid key are auto-registered (set the
  `enforceKnownDevices` setting to `true` through `PUT /api/demo/settings`
  to demo the strict `401 UNKNOWN_DEVICE` contract behaviour, which is what
  EasyDoct does).

So: point the kiosk at this editor (`REACT_APP_JOURNEY_BACKEND=contract`,
`REACT_APP_CONTRACT_BASE_URL=http://localhost:3020`) and run a journey:
identify (or QR = the appointment `visibleId`), documents, check-in — the
kiosk's `proposedTicket` is **adopted** (see the check-in handler), so the
printed ticket matches the agenda card. For the outbound pushes, fill the
**ApiBorne licence UUID** (copied from the ApiBorne admin, Connectivity
page) + ApiBorne server URL in `/settings`.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on port 3020 (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run check` | ESLint + `tsc --noEmit` |
| `npm run db:reset` | Delete `data/demo.db` (recreated + seeded on next start) |

## Demo credentials

- Staff sign-in (Cockpit): `reception@demo-ris.example` / `demo1234`
- Contract auth key: captured on first use (or pin it via
  `SEED_KIOSK_AUTH_KEY` / `PUT /api/demo/settings`)
- Devices: auto-registered on first contact (seeded examples:
  `DEMO-KIOSK-1`, `DEMO-KIOSK-2`)

Everything in this repository — names, NIRs, credentials — is fake demo data.
