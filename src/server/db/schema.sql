-- ---------------------------------------------------------------------------
-- Demo RIS editor — SQLite schema
--
-- This is the entire persistent state of the demo editor. It is intentionally
-- small and denormalized: the goal is to make the Kiosk Integration Contract
-- implementation easy to read, not to model a production RIS.
--
-- The database file (data/demo.db) is created and seeded automatically on
-- first access (see db.ts / seed.ts). Delete it (npm run db:reset) to start
-- fresh.
-- ---------------------------------------------------------------------------

-- Radiologists / practitioners shown as columns of the agenda day view.
CREATE TABLE IF NOT EXISTS practitioners (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name   TEXT NOT NULL,
  rpps_id     TEXT,                -- French practitioner registry id (fake)
  color       TEXT NOT NULL        -- agenda column accent color (hex)
);

-- Exam rooms.
CREATE TABLE IF NOT EXISTS rooms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL
);

-- Exam types. `ticket_prefix` feeds the call ticket format ("RA" -> "RA-12").
CREATE TABLE IF NOT EXISTS exam_types (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,     -- e.g. "RADIO", "SCANNER", "IRM"
  ticket_prefix TEXT NOT NULL      -- e.g. "RA", "SC", "IR"
);

-- Individual exams offered by the clinic (e.g. "RADIO BASSIN"), each belonging
-- to an exam type — same referential split as EasyDoct (Exam vs ExamType).
-- Configurable in the /referentials page; used by the agenda creation dialog
-- and the random generator, and exposed to ApiBorne via GET /config/exams.
CREATE TABLE IF NOT EXISTS exams (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,     -- e.g. "RADIO BASSIN"
  exam_type_id  INTEGER NOT NULL REFERENCES exam_types(id)
);

-- Patients. All identities are FAKE demo data.
-- `social_security_id` is stored WITHOUT spaces; the contract requires the
-- editor to tolerate spaces in the incoming criteria (normalized in code).
CREATE TABLE IF NOT EXISTS patients (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name         TEXT NOT NULL,
  last_name          TEXT NOT NULL,
  birth_date         TEXT NOT NULL,           -- ISO date YYYY-MM-DD
  social_security_id TEXT,                    -- French NIR, digits only, fake
  email              TEXT,
  phone              TEXT,                    -- landline (contract `phone`)
  -- Fields editable from the kiosk's identity-verification screen
  -- (contract PATCH /patients/{id}, PatientUpdate schema):
  mobile_phone       TEXT,                    -- contract `mobilePhone`
  address_line       TEXT,                    -- contract `address.line1`
  address_line2      TEXT,                    -- contract `address.line2`
  zip_code           TEXT,
  city               TEXT,
  height_cm          REAL,                    -- contract `heightCm`
  weight_kg          REAL,                    -- contract `weightKg`
  referring_practitioner_name    TEXT,        -- contract `referringPractitioner.name`
  referring_practitioner_rpps_id TEXT         -- contract `referringPractitioner.rppsId`
);

-- Appointments. `status` follows the CONTRACT enum, not an internal one:
--   scheduled -> checkedIn -> inCare -> done   (+ cancelled)
-- `visible_id` doubles as the QR code payload used by GET /appointments/by-code.
-- The pair (id, visible_id) is exposed to the contract as the opaque id
-- "{id}~{visible_id}" (see mappers.ts) — same convention as EasyDoct, so the
-- ApiBorne server reconciliation works identically against this demo.
CREATE TABLE IF NOT EXISTS appointments (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  visible_id               TEXT NOT NULL UNIQUE,  -- opaque public id / QR code
  patient_id               INTEGER NOT NULL REFERENCES patients(id),
  practitioner_id          INTEGER NOT NULL REFERENCES practitioners(id),
  room_id                  INTEGER REFERENCES rooms(id),
  exam_type_id             INTEGER NOT NULL REFERENCES exam_types(id),
  exam_label               TEXT NOT NULL,         -- displayable exam label
  start_date               TEXT NOT NULL,         -- ISO 8601 with offset
  duration_minutes         INTEGER NOT NULL DEFAULT 20,
  status                   TEXT NOT NULL DEFAULT 'scheduled'
                           CHECK (status IN ('scheduled','checkedIn','inCare','done','cancelled')),
  -- Call ticket, set at check-in (kiosk) or arrival (agenda). When the kiosk
  -- proposes a ticket reserved on the ApiBorne server (proposedTicket), this
  -- demo ADOPTS it (see check-in route) so the printed ticket, the agenda and
  -- the ApiBorne Cockpit all display the same number.
  ticket_number            INTEGER,
  ticket_number_formatted  TEXT,
  -- Vendor-neutral anomaly codes reported by the kiosk at check-in (JSON array).
  anomaly_codes            TEXT,
  checked_in_at            TEXT,                  -- ISO timestamp of check-in
  prescriber_name          TEXT,
  prescriber_rpps_id       TEXT,
  -- Preparatory survey state exposed on the contract (preparatorySurveyCompleted):
  -- NULL = no survey expected for this appointment, 0 = expected but not filled,
  -- 1 = filled. Lets the ApiBorne server evaluate notification conditions locally.
  preparatory_survey_completed INTEGER,
  -- Required document types for THIS appointment (JSON array of the contract's
  -- vendor-neutral documentType strings, e.g. ["prescription","mriQuestionnaire"]).
  -- NULL = fall back to the demo default (prescription only). Served to the kiosk
  -- as `requiredDocumentTypes` by GET /appointments/{id}/documents.
  required_document_types TEXT,
  -- Trace of the kiosk-reported `documentsComplete` boolean at check-in:
  -- NULL = kiosk did not handle documents (or no kiosk check-in yet),
  -- 0 = file incomplete at arrival, 1 = complete.
  checkin_documents_complete INTEGER
);

-- Office places (sites / waiting areas) — the shared places referential
-- exposed to ApiBorne via GET /config/office-places. The demo seeds a single
-- site; more can be added from the /referentials page to exercise the
-- multi-place features of the admin (device places, per-place offsets…).
CREATE TABLE IF NOT EXISTS office_places (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL
);

-- Documents attached to an appointment (uploaded from the kiosk or elsewhere).
-- `document_type` is the vendor-neutral string enum of contract/document-types.md.
-- Pages are stored as a JSON array of { contentBase64, mimeType } — good enough
-- for a demo; a real RIS would store files properly.
CREATE TABLE IF NOT EXISTS documents (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id),
  document_type  TEXT NOT NULL,
  label          TEXT,
  rotation_angle INTEGER NOT NULL DEFAULT 0,
  pages_json     TEXT NOT NULL,
  created_at     TEXT NOT NULL
);

-- Document types referential — THE EDITOR OWNS IT (contract GET
-- /config/document-types). Codes follow the contract's standard vocabulary
-- (contract/document-types.md) whenever one matches; editor-specific codes
-- are allowed. `code` is what travels on the contract (documentType).
-- NOTE: this referential only BUILDS the list — custom labels and the
-- "patient can provide it from their phone" flag are configured in the
-- ApiBorne admin (Required documents settings), NOT here.
CREATE TABLE IF NOT EXISTS document_types (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  code               TEXT NOT NULL UNIQUE,
  label              TEXT NOT NULL
);

-- Reception staff accounts, used by POST /staff/sign-in (ApiBorne Cockpit
-- external login). Passwords are stored in PLAIN TEXT because this is a demo
-- with fake accounts — a real editor must hash them.
CREATE TABLE IF NOT EXISTS staff_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  login         TEXT NOT NULL UNIQUE,
  password      TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL
);

-- Kiosk devices known by this editor. A contract call whose X-Kiosk-Device-Id
-- is not in this table is rejected with 401 UNKNOWN_DEVICE.
CREATE TABLE IF NOT EXISTS kiosk_devices (
  device_id  TEXT PRIMARY KEY,
  label      TEXT
);

-- Key/value settings (auth key, office identity, ApiBorne server URL, flags).
-- Seeded from .env.local on first start, editable in the /settings page.
CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments (start_date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_appointment ON documents (appointment_id);
