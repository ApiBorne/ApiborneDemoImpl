# AGENTS.md — code map for AI assistants

This repository is a **reference implementation of the ApiBorne Kiosk
Integration Contract** (editor/RIS side). If you are analyzing or extending
it, start here.

## What this app is

Two worlds in one Next.js app:

1. **The contract API** (`src/app/api/apiborneIntegrationService/v1/**`) —
   the 12 operations an ApiBorne check-in kiosk (and the ApiBorne server)
   call. The spec is `contract/openapi.yaml`; the practical guide is
   `docs/CONTRACT_GUIDE.md`. This is the part an editor copies.
2. **A demo RIS UI** (`src/app/page.tsx` agenda, `/patients`, `/settings`)
   with its own internal API (`src/app/api/demo/**`) — tooling to exercise
   the contract; a kiosk never calls these routes.

## Directory map

```
contract/                     Bundled copy of the contract spec (source of truth)
docs/CONTRACT_GUIDE.md        Step-by-step editor implementation guide
src/
  app/
    api/apiborneIntegrationService/v1/**  THE CONTRACT — one route.ts per operation,
                                          each with a header comment stating the
                                          semantics it implements
    api/demo/**               Internal UI API (agenda, patients, settings, reset)
    page.tsx                  Agenda day view (client component)
    patients/ settings/       Secondary pages
  server/
    contract/                 Shared contract building blocks:
      auth.ts                 2-header auth, validation order, key-only variant
      errors.ts               Normalized {error:{code,message,details}} + statuses
      cors.ts                 CORS headers + shared OPTIONS handler
      encryption.ts           Optional end-to-end encryption (AES-256-GCM +
                              RSA-OAEP-SHA256), withContractCrypto wrapper on
                              the 10 communication routes; keys:generate /
                              encrypted-curl scripts
      mappers.ts              SQLite rows -> contract DTOs, "{id}~{visibleId}" ids,
                              vendorData round-trip
      resolve.ts              Appointment resolution + AppointmentDetail shape
    apiborne/client.ts        OUTBOUND calls to the ApiBorne server
                              (issueForAppointment, appointmentStatusChanged)
    demo/actions.ts           Receptionist actions — WHERE the outbound calls
                              are triggered (arrival = ticket issuance)
    db/
      schema.sql              The whole persistent model, commented
      db.ts / seed.ts         Lazy open + idempotent migrate + seed-if-empty
      repositories.ts         Typed synchronous data access (no ORM)
      types.ts                Row types + the contract status enum
  components/ui/**            shadcn/ui components (generated, unmodified)
  components/agenda/**        Day grid, appointment card, create dialog
  lib/api/client.ts           Typed fetch client for /api/demo/**
```

## Invariants to preserve

- **Appointment contract id** is `"{id}~{visibleId}"` (`mappers.ts`). The
  ApiBorne server stores it verbatim (`contractAppointmentId`) and uses it
  for reconciliation — changing the encoding breaks the round-trip.
- **`status` values are the contract enum** (`scheduled|checkedIn|inCare|done|cancelled`)
  stored as-is in SQLite. No internal/status mapping layer exists on purpose.
- **check-in is idempotent**; `409 ALREADY_CHECKED_IN` only for done/cancelled.
- **`proposedTicket` is adopted** at check-in (kiosk already printed it).
- **Outbound pushes are best-effort**: never let an ApiBorne call failure
  break a receptionist action or a contract response.
- **Error bodies** always go through `contractError()` — never hand-craft
  a JSON error in a handler.
- All UI/API date exchanges are ISO 8601.

## Commands

- `npm run dev` — port 3020 · `npm run check` — lint + typecheck ·
  `npm run db:reset` — wipe the SQLite file (reseeded on next start).

## Fake data

Every identity, NIR, credential and key in this repo is invented demo data
(`src/server/db/seed.ts`). Staff login: `reception@demo-ris.example` /
`demo1234`. Default auth key: `demo-auth-key`; devices `DEMO-KIOSK-1/2`.
