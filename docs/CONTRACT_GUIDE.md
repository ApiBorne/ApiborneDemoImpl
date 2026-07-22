# Implementing the Kiosk Integration Contract — editor guide

A step-by-step guide for a medical management system (RIS, EMR…) editor implementing the ApiBorne Kiosk
Integration Contract. The normative spec is
[`../contract/openapi.yaml`](../contract/openapi.yaml); this guide adds the
practical order of work and the pitfalls, and every step links the working
implementation in this repository.

## 0. Ground rules (read once, apply everywhere)

- **Base path is imposed**: everything lives under
  `/api/apiborneIntegrationService/v1`. JSON is camelCase, dates are ISO 8601
  (`birthDate` = `YYYY-MM-DD`, `startDate` with timezone offset).
- **Authentication** ([`auth.ts`](../src/server/contract/auth.ts)): every
  kiosk call carries `X-Kiosk-Auth-Key` (shared key) and `X-Kiosk-Device-Id`
  (provisioned device). Validate the DEVICE first (`401 UNKNOWN_DEVICE`),
  then the key (`401 INVALID_AUTH_KEY`). Never redirect a 401.
  Exception: `POST /staff/sign-in` and `PUT /appointments/{id}/status` are
  called by the ApiBorne **server**, not a kiosk → auth key only.
- **Caller identity — `X-Kiosk-Office-Id`**: ApiBorne also sends this header
  on every call so a MULTI-SITE editor can select the target office/licence
  group WITHOUT resolving it from its device table (the kiosk fleet is
  managed in the ApiBorne admin). Its value is the free identifier entered in
  the ApiBorne integration settings (EasyDoct uses the composed form
  `{officeId}!#!{officeVisibleId}`). A single-site editor (like this demo)
  can simply ignore it.
  *Demo convenience (not normative)*: since the key and the kiosk fleet are
  already managed in the ApiBorne admin, this demo defaults to
  trust-on-first-use for the key and auto-registration for devices — flip
  "Enforce known devices" in `/settings` to exercise the strict behaviour
  that a production editor (like EasyDoct) implements.
- **Errors** ([`errors.ts`](../src/server/contract/errors.ts)): real HTTP
  status codes + `{ "error": { "code", "message", "details" } }`. The kiosk
  treats every 4xx as final and retries 5xx/network — wrong status codes
  break the retry behaviour. `message` is for logs, never shown to patients.
- **CORS** ([`cors.ts`](../src/server/contract/cors.ts)): the kiosk is a
  browser app. Answer `OPTIONS`, allow `GET/POST/PUT/PATCH/DELETE` and the
  `Content-Type, X-Kiosk-Auth-Key, X-Kiosk-Device-Id` headers.
- **`context.config`**: when the kiosk sends its configuration subset, use it
  and NEVER call the ApiBorne server back. Silently ignore unknown properties.
- **`vendorData`** ([`mappers.ts`](../src/server/contract/mappers.ts)): any
  opaque object (< 4 KB) you return on a response/patient/appointment is
  echoed back untouched by the kiosk on later calls about the same entity.
  Use it to carry your internal keys.

## 1. The journey routes — implement these five first

ALL contract routes are mandatory (see §2 for the minimal conforming forms),
but a kiosk can run a full check-in journey with these five alone — start
here:

1. **`POST /patients/identify`**
   ([handler](../src/app/api/apiborneIntegrationService/v1/patients/identify/route.ts)) —
   combine ALL provided criteria; the NIR has priority and MUST tolerate
   spaces; no match → `200 { "patients": [] }` (not an error); patient
   without appointments today → `appointments: []`; cap the result (~10).
2. **`GET /appointments/by-code/{code}`**
   ([handler](../src/app/api/apiborneIntegrationService/v1/appointments/by-code/%5Bcode%5D/route.ts)) —
   the QR-code entry point. The code format is yours (this demo uses the
   appointment `visibleId`). Make sure no appointment id can literally be
   `by-code` (route collision).
3. **`GET /appointments/{id}`**
   ([handler](../src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/route.ts)) —
   canonical reload. Also used by the ApiBorne server to re-verify displayed
   tickets: return an accurate `status` and `startDate`.
4. **`POST /appointments/{id}/check-in`**
   ([handler](../src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/check-in/route.ts)) —
   the critical operation:
   - **idempotent**: a network replay must return `200` with the EXISTING
     ticket — reserve `409 ALREADY_CHECKED_IN` for truly incompatible states
     (done/cancelled);
   - store `anomalyCodes` verbatim (vendor-neutral strings);
   - multi-appointment journeys: one call per appointment
     (`sequence.number` 1 = main, others carry `mainAppointmentId`);
   - **`proposedTicket`**: the ticket the kiosk already reserved on the
     ApiBorne server (and printed). You MAY adopt it and MUST accept it
     without error otherwise. **Adopt it** — this demo does — so the printed
     ticket, your agenda and the ApiBorne Cockpit all show the same number.
5. **`GET /appointments/{id}/notification-readiness`**
   ([handler](../src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/notification-readiness/route.ts)) —
   ALWAYS answer (worst case `{ "ready": true }`, never 501): the kiosk
   blocks the journey on a negative answer.

## 2. The remaining routes — mandatory too, minimal forms accepted

There are NO optional routes and no support declaration: every route below
must exist. An editor without the feature answers the minimal conforming
form — empty document lists (the kiosk skips the flow), `204` no-op,
systematic `404` for convocation codes, systematic `401` for staff sign-in.
`501 NOT_SUPPORTED` is deprecated. This keeps the ApiBorne configuration
free of per-route exceptions:

- **`PATCH /patients/{patientId}`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/patients/%5BpatientId%5D/route.ts)) —
  PATCH semantics: absent field = unchanged, explicit `null` = cleared.
  Reply `204` without a body.
- **`PUT /appointments/{id}/prescriber`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/prescriber/route.ts)).
- **Documents** ([handler](../src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/documents/route.ts)) —
  `documentType` is the string enum of
  [`../contract/document-types.md`](../contract/document-types.md); pages are
  base64 WITHOUT the `data:` prefix; accept ≥ 10 MB per request
  (`413 UPLOAD_TOO_LARGE` beyond); answer < 60 s; replacement =
  DELETE then POST; `analysis.prescriberProposals` is an optional bonus
  (OCR) that feeds the kiosk's prescriber picker.
- **`PUT /appointments/{id}/status`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/appointments/%5BappointmentId%5D/status/route.ts)) —
  the ApiBorne Cockpit writing back into your agenda. FORWARD-ONLY
  (`checkedIn → inCare → done`), idempotent, `400` on cancelled/done.
- **`POST /staff/sign-in`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/staff/sign-in/route.ts)) —
  Cockpit login with YOUR credentials. Auth key only; invalid credentials →
  `401 INVALID_CREDENTIALS`; return the user's offices + a stable
  `userEmail`.

### Configuration routes (ApiBorne extension)

Five auth-key-only GET routes expose your reference data to the ApiBorne
server (the same referential families as EasyDoct's config service); ApiBorne
also **probes them to validate the integration** before unlocking the rest of
its admin configuration, so implement them early:

- **`GET /config/office-places`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/config/office-places/route.ts)) —
  `{ officePlaces: [{ id, name }] }`.
- **`GET /config/exam-types`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/config/exam-types/route.ts)) —
  `{ examTypes: [{ id, name, ticketPrefix }] }`; `ticketPrefix` seeds the
  call-ticket format (overridable in the ApiBorne admin).
- **`GET /config/practitioners`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/config/practitioners/route.ts)) —
  `{ practitioners: [{ id, name, rppsId }] }`.
- **`GET /config/rooms`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/config/rooms/route.ts)) —
  `{ rooms: [{ id, name }] }`.
- **`GET /config/exams`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/config/exams/route.ts)) —
  `{ exams: [{ id, name, examTypeId }] }` (individual exams, each belonging
  to an exam type — EasyDoct's Exam vs ExamType split).
- **`GET /config/document-types`**
  ([handler](../src/app/api/apiborneIntegrationService/v1/config/document-types/route.ts)) —
  `{ documentTypes: [{ documentType, label }] }`. THE
  editor-owned referential behind required documents: reuse the contract's
  standard vocabulary (41 codes, `../contract/document-types.md`) when a code
  matches, add your own codes freely. Recommended but NOT probed by the
  config-check. Editable in `/referentials` in this demo. It only BUILDS the
  list — custom labels and the "patient can provide it from their phone" flag
  are configured in the ApiBorne admin (Required documents settings).

In this demo the underlying data is editable in the `/referentials` page.

## 3. Outbound notifications (ApiBorne-managed configuration)

When the kiosk configuration is managed by the ApiBorne middleware, your
system should also PUSH two best-effort notifications
([client](../src/server/apiborne/client.ts), wired in
[`actions.ts`](../src/server/demo/actions.ts)):

- **`issueForAppointment`** on an arrival marked in YOUR agenda: ask ApiBorne
  for the ticket number (one shared sequence with kiosk check-ins). Key
  detail: the `requestUid` must be unique PER GENERATION — cancelling an
  arrival and re-marking it must consume a NEW number. Always fall back to
  local numbering on failure: marking an arrival must never fail.
- **`appointmentStatusChanged`** on EVERY status change (fire-and-forget,
  short timeout): this is what makes the ApiBorne Cockpit reflect your agenda
  in ~1–2 s.

Wire format for both: `Authorization` header = the RAW shared key, plus in the
payload the **`licenceUuid`** (shown in the ApiBorne admin, Connectivity page) —
it identifies the target licence UNAMBIGUOUSLY, since several licences can
share one brand/key. The office identity (`officeId`, `officeVisibleId`,
`brandId`) stays in the payload as the compatibility fallback.

## 4. End-to-end encryption (optional contract feature)

The contract lets an establishment encrypt the kiosk↔editor channel above
TLS, with a key pair ONLY the editor can decrypt (the ApiBorne server relays
blindly — zero-knowledge). Full protocol: `contract/openapi.yaml`, section
« Chiffrement de bout en bout » + schema `EncryptedEnvelope`.

What this demo implements (copy it):

- [`encryption.ts`](../src/server/contract/encryption.ts) — the whole
  protocol in `node:crypto`: private-key parsing with rotation (several
  concatenated PEMs, each tried at unwrap), RSA-OAEP-SHA256 session-key
  unwrap, AES-256-GCM envelope decrypt (128-bit tag CONCATENATED after the
  ciphertext — WebCrypto convention), and 2xx response sealing with the SAME
  session key and a FRESH IV.
- `withContractCrypto(handler)` wraps the **10 communication routes only**
  (never `/config/*`, `staff/sign-in` or `PUT status`). Auth runs BEFORE any
  decryption (don't be a decryption oracle), errors stay in CLEAR, and a
  clear body under encryption headers is rejected (`DECRYPTION_FAILED`,
  anti-downgrade).
- [`cors.ts`](../src/server/contract/cors.ts) — `X-Kiosk-Encryption` and
  `X-Kiosk-Encryption-Key` added to `Access-Control-Allow-Headers`, and
  `Access-Control-Expose-Headers: X-Kiosk-Encryption`. Forgetting this fails
  the browser preflight SILENTLY.

Tooling:

- `npm run keys:generate` — RSA-4096 pair; stores the private key in the
  demo settings (newest first — rotation) and prints the public key to paste
  in the ApiBorne admin (Connectivity page). Order matters: private key
  deployed on the editor FIRST, public key pasted in the admin AFTER.
- `npm run encrypted-curl -- POST /patients/identify '{"criteria":…}'` — a
  kiosk-equivalent test oracle: encrypts, calls, decrypts. Flags:
  `--url` (point it at YOUR implementation), `--public-key <pem>`,
  `--corrupt-tag` (your editor must answer `400 DECRYPTION_FAILED`),
  `--plain` (compat check: no headers → clear round-trip).
- `/settings` — paste/rotate private keys, strict mode (reject clear calls),
  "encryption active" badge.

Sizing note: the 10 MB upload minimum is on the CLEAR JSON; the encrypted
transport adds ~35 % (base64) — raise your HTTP body limit accordingly.

## 5. Test checklist

Run these against your implementation (all pass against this demo):

- [ ] `identify` without headers → `401` with a normalized body
- [ ] `identify` with a NIR containing spaces → the patient is found
- [ ] `by-code` with an unknown code → `404 UNKNOWN_APPOINTMENT`
- [ ] `check-in` with a `proposedTicket` → the response echoes that ticket
- [ ] same `check-in` replayed → `200` with the SAME ticket (no duplicate)
- [ ] `check-in` on a done/cancelled appointment → `409 ALREADY_CHECKED_IN`
- [ ] document upload > your limit → `413 UPLOAD_TOO_LARGE`
- [ ] `PUT status` backward (inCare → checkedIn) → `200` without effect
- [ ] `staff/sign-in` with bad credentials → `401 INVALID_CREDENTIALS`
- [ ] encryption on: encrypted `identify`/upload → `200/201` encrypted
      responses; corrupted tag → `400 DECRYPTION_FAILED`; no headers →
      clear round-trip (unless strict mode)
