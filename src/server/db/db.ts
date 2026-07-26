/**
 * SQLite access — single shared connection, created lazily on first use.
 *
 * Design notes for readers:
 *  - `better-sqlite3` is synchronous, which keeps every repository function a
 *    plain function (no async ceremony) — ideal for a reference implementation.
 *  - The schema is applied idempotently from schema.sql on every boot
 *    (CREATE TABLE IF NOT EXISTS), and the seed runs only when the database
 *    is empty. Delete data/demo.db (npm run db:reset) to start fresh.
 *  - Next.js dev mode reloads modules: the connection is cached on
 *    `globalThis` so hot reloads never leak file handles.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  seedDocumentTypesIfEmpty,
  seedExamsIfEmpty,
  seedIfEmpty,
  seedOfficePlacesIfEmpty,
} from "./seed";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "demo.db");

const globalForDb = globalThis as unknown as { __demoRisDb?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__demoRisDb) {
    return globalForDb.__demoRisDb;
  }
  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schema = fs.readFileSync(path.join(process.cwd(), "src", "server", "db", "schema.sql"), "utf8");
  db.exec(schema);
  seedIfEmpty(db);
  // Backfill for databases created before the `exams` referential existed
  seedExamsIfEmpty(db);
  // Backfill for databases created before the `office_places` referential existed
  seedOfficePlacesIfEmpty(db);
  // Backfill for databases created before the `document_types` referential existed
  seedDocumentTypesIfEmpty(db);
  // Backfill for databases created before the preparatory-survey column existed
  const appointmentColumns = db.prepare("PRAGMA table_info(appointments)").all() as { name: string }[];
  if (!appointmentColumns.some((column) => column.name === "preparatory_survey_completed")) {
    db.exec("ALTER TABLE appointments ADD COLUMN preparatory_survey_completed INTEGER");
  }
  // Backfill for databases created before per-appointment required documents
  if (!appointmentColumns.some((column) => column.name === "required_document_types")) {
    db.exec("ALTER TABLE appointments ADD COLUMN required_document_types TEXT");
  }
  if (!appointmentColumns.some((column) => column.name === "checkin_documents_complete")) {
    db.exec("ALTER TABLE appointments ADD COLUMN checkin_documents_complete INTEGER");
  }
  // Backfill for databases created before the per-appointment office place
  if (!appointmentColumns.some((column) => column.name === "office_place_id")) {
    db.exec("ALTER TABLE appointments ADD COLUMN office_place_id INTEGER REFERENCES office_places(id)");
  }
  // Backfill for databases created before the kiosk-editable patient fields
  // (contract PATCH /patients/{id}): mobile phone, address line2, biometry,
  // referring practitioner. mobile_phone starts from the seeded `phone`.
  const patientColumns = db.prepare("PRAGMA table_info(patients)").all() as { name: string }[];
  const patientBackfills: [string, string][] = [
    ["mobile_phone", "TEXT"],
    ["address_line2", "TEXT"],
    ["height_cm", "REAL"],
    ["weight_kg", "REAL"],
    ["referring_practitioner_name", "TEXT"],
    ["referring_practitioner_rpps_id", "TEXT"],
  ];
  for (const [column, type] of patientBackfills) {
    if (!patientColumns.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE patients ADD COLUMN ${column} ${type}`);
      if (column === "mobile_phone") {
        db.exec("UPDATE patients SET mobile_phone = phone WHERE mobile_phone IS NULL");
      }
    }
  }

  globalForDb.__demoRisDb = db;
  return db;
}

/** Drops every table's content and re-seeds — used by the /settings reset button. */
export function resetAndReseed(): void {
  const db = getDb();
  db.exec(
    [
      "DELETE FROM documents",
      "DELETE FROM appointments",
      "DELETE FROM patients",
      "DELETE FROM staff_users",
      "DELETE FROM kiosk_devices",
      "DELETE FROM exams",
      "DELETE FROM exam_types",
      "DELETE FROM rooms",
      "DELETE FROM office_places",
      "DELETE FROM document_types",
      "DELETE FROM practitioners",
      "DELETE FROM settings",
    ].join(";"),
  );
  seedIfEmpty(db);
  seedExamsIfEmpty(db);
  seedOfficePlacesIfEmpty(db);
  seedDocumentTypesIfEmpty(db);
}
