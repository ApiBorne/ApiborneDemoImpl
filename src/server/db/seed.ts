/**
 * Seed data — realistic but entirely FAKE French radiology-clinic dataset:
 * practitioners, rooms, exam types, patients (fake identities and NIRs),
 * a handful of appointments for "today", one reception staff account, the
 * known kiosk devices and the settings (from .env.local, with safe defaults).
 *
 * Runs once, when the `practitioners` table is empty (see db.ts).
 */
import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { DOCUMENT_TYPES as STANDARD_DOCUMENT_TYPES } from "@/lib/document-types";

export const DEMO_STAFF_LOGIN = "reception@demo-ris.example";
export const DEMO_STAFF_PASSWORD = "demo1234";

function isoDateAt(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function newVisibleId(): string {
  // Opaque public appointment id — also the QR-code payload understood by
  // GET /appointments/by-code/{code}. Any stable format works; a UUID keeps
  // it clearly non-guessable and never collides with the "by-code" literal.
  return crypto.randomUUID();
}

/**
 * Seeds the `exams` referential from the exam-type names. Split out of
 * seedIfEmpty and re-run on every boot so databases created BEFORE the exams
 * table existed get backfilled without a reset.
 */
export function seedExamsIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM exams").get() as { n: number };
  if (count.n > 0) {
    return;
  }
  const examsByTypeName: Record<string, string[]> = {
    RADIO: ["RADIO BASSIN", "RADIO THORAX", "RADIO EPAULE", "RADIO GENOU"],
    SCANNER: ["SCANNER ABDOMINAL", "SCANNER CEREBRAL", "SCANNER THORACIQUE"],
    IRM: ["IRM GENOU", "IRM LOMBAIRE", "IRM CEREBRALE"],
    ECHOGRAPHIE: ["ECHOGRAPHIE ABDOMINALE", "ECHOGRAPHIE THYROIDE"],
  };
  const examTypes = db.prepare("SELECT id, name FROM exam_types").all() as {
    id: number;
    name: string;
  }[];
  const insertExam = db.prepare("INSERT INTO exams (name, exam_type_id) VALUES (?, ?)");
  for (const examType of examTypes) {
    for (const examName of examsByTypeName[examType.name] ?? []) {
      insertExam.run(examName, examType.id);
    }
  }
}

/**
 * Lieux : un site unique par défaut (id 1, aligné sur le setting officeId).
 * Backfillé à chaque boot pour les bases créées avant le référentiel.
 */
export function seedOfficePlacesIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM office_places").get() as { n: number };
  if (count.n > 0) {
    return;
  }
  db.prepare("INSERT INTO office_places (name) VALUES (?)").run("Demo Radiology Clinic");
}

/**
 * Document types referential — seeded with the contract's STANDARD vocabulary
 * (41 codes, contract/document-types.md). The editor owns this referential:
 * rows are editable in /referentials and served by GET /config/document-types.
 */
export function seedDocumentTypesIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM document_types").get() as { n: number };
  if (count.n > 0) {
    return;
  }
  const insert = db.prepare("INSERT INTO document_types (code, label) VALUES (?, ?)");
  for (const type of STANDARD_DOCUMENT_TYPES) {
    insert.run(type.documentType, type.label);
  }
}

export function seedIfEmpty(db: Database.Database): void {
  const count = db.prepare("SELECT COUNT(*) AS n FROM practitioners").get() as { n: number };
  if (count.n > 0) {
    return;
  }

  const insertPractitioner = db.prepare(
    "INSERT INTO practitioners (full_name, rpps_id, color) VALUES (?, ?, ?)",
  );
  insertPractitioner.run("Dr Alice MARTIN", "10101010101", "#6366f1");
  insertPractitioner.run("Dr Bruno LEROY", "10202020202", "#059669");
  insertPractitioner.run("Dr Chloé DUBOIS", "10303030303", "#d97706");

  const insertRoom = db.prepare("INSERT INTO rooms (name) VALUES (?)");
  insertRoom.run("Room 1 — X-ray");
  insertRoom.run("Room 2 — CT scan");
  insertRoom.run("Room 3 — MRI");
  insertRoom.run("Room 4 — Ultrasound");

  const insertExamType = db.prepare(
    "INSERT INTO exam_types (name, ticket_prefix) VALUES (?, ?)",
  );
  insertExamType.run("RADIO", "RA");
  insertExamType.run("SCANNER", "SC");
  insertExamType.run("IRM", "IR");
  insertExamType.run("ECHOGRAPHIE", "EC");

  seedExamsIfEmpty(db);
  seedOfficePlacesIfEmpty(db);

  // Fake patients. The NIRs are syntactically plausible but invented.
  const insertPatient = db.prepare(
    `INSERT INTO patients (first_name, last_name, birth_date, social_security_id, email, phone, mobile_phone, address_line, zip_code, city)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const patients: [string, string, string, string][] = [
    ["Jean", "DUPONT", "1980-04-12", "180047512345678"],
    ["Marie", "CURIE", "1975-11-07", "275117823456789"],
    ["Paul", "BERNARD", "1992-02-28", "192026734567890"],
    ["Sophie", "MOREAU", "1988-09-15", "288097845678901"],
    ["Lucas", "PETIT", "2001-06-03", "101065656789012"],
    ["Emma", "ROUX", "1969-12-21", "269126967890123"],
    ["Hugo", "GARNIER", "1955-03-30", "155037578901234"],
    ["Léa", "FONTAINE", "1997-08-09", "297088689012345"],
  ];
  for (const [firstName, lastName, birthDate, nir] of patients) {
    insertPatient.run(
      firstName,
      lastName,
      birthDate,
      nir,
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      "0467000000",
      "0600000000",
      "1 rue de la Démo",
      "34300",
      "Agde",
    );
  }

  // Patient e2e aligné sur la carte Vitale SIMULÉE par défaut de la borne
  // (SimulateVitalCard.js : ROUSSEAU GUILLAUME, 10/06/1973, NIR partagé de la
  // carte famille) + un RDV en toute fin de journée : toujours « dans le
  // futur » pendant les heures de run → déclenche le flux « patient trop en
  // avance » quand maxEarlyArrivalMinutes est configuré. Seedé UNIQUEMENT en
  // mode e2e (SEED_E2E_KIOSK_PATIENT) pour ne pas polluer l'agenda de démo.
  const seedE2eKioskPatient = process.env.SEED_E2E_KIOSK_PATIENT === "true";
  let e2ePatientId: number | bigint | null = null;
  if (seedE2eKioskPatient) {
    const inserted = insertPatient.run(
      "Guillaume",
      "ROUSSEAU",
      "1973-06-10",
      "173067511218814",
      "guillaume.rousseau@example.com",
      "0467000000",
      "0600000000",
      "1 rue de la Démo",
      "34300",
      "Agde",
    );
    e2ePatientId = inserted.lastInsertRowid;
  }

  // A few appointments today so the agenda is not empty on first launch.
  const insertAppointment = db.prepare(
    `INSERT INTO appointments (visible_id, patient_id, practitioner_id, room_id, exam_type_id, exam_label, start_date, duration_minutes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
  );
  insertAppointment.run(newVisibleId(), 1, 1, 1, 1, "RADIO BASSIN", isoDateAt(9, 0), 20);
  insertAppointment.run(newVisibleId(), 2, 1, 1, 1, "RADIO THORAX", isoDateAt(10, 20), 20);
  insertAppointment.run(newVisibleId(), 3, 2, 2, 2, "SCANNER ABDOMINAL", isoDateAt(9, 40), 30);
  insertAppointment.run(newVisibleId(), 4, 2, 2, 2, "SCANNER CEREBRAL", isoDateAt(14, 0), 30);
  insertAppointment.run(newVisibleId(), 5, 3, 3, 3, "IRM GENOU", isoDateAt(11, 0), 40);
  insertAppointment.run(newVisibleId(), 6, 3, 4, 4, "ECHOGRAPHIE ABDOMINALE", isoDateAt(15, 30), 20);
  if (e2ePatientId != null) {
    // RDV e2e « trop en avance » : 23:30 — voir le commentaire du patient e2e.
    insertAppointment.run(
      newVisibleId(),
      e2ePatientId,
      1,
      1,
      1,
      "RADIO E2E FIN DE JOURNEE",
      isoDateAt(23, 30),
      20,
    );
  }
  // Preparatory-survey showcase (contract field preparatorySurveyCompleted):
  // the IRM has its survey filled, the SCANNER ABDOMINAL is still waiting for
  // it, every other appointment expects no survey (NULL).
  db.prepare("UPDATE appointments SET preparatory_survey_completed = 1 WHERE exam_label = 'IRM GENOU'").run();
  db.prepare(
    "UPDATE appointments SET preparatory_survey_completed = 0 WHERE exam_label = 'SCANNER ABDOMINAL'",
  ).run();
  // Required-documents showcase: each modality expects its own document types
  // (contract enum strings); unset rows fall back to ["prescription"].
  const setRequiredDocs = db.prepare(
    "UPDATE appointments SET required_document_types = ? WHERE exam_label LIKE ?",
  );
  setRequiredDocs.run(JSON.stringify(["prescription", "creatinineResults"]), "SCANNER %");
  setRequiredDocs.run(JSON.stringify(["prescription", "mriQuestionnaire"]), "IRM %");

  db.prepare(
    "INSERT INTO staff_users (login, password, display_name, email) VALUES (?, ?, ?, ?)",
  ).run(DEMO_STAFF_LOGIN, DEMO_STAFF_PASSWORD, "Demo Receptionist", DEMO_STAFF_LOGIN);

  const insertDevice = db.prepare("INSERT INTO kiosk_devices (device_id, label) VALUES (?, ?)");
  const deviceIds = (process.env.SEED_KNOWN_DEVICE_IDS ?? "DEMO-KIOSK-1,DEMO-KIOSK-2")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const deviceId of deviceIds) {
    insertDevice.run(deviceId, `Demo kiosk ${deviceId}`);
  }

  const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  // Empty by default: the key is CAPTURED from the first contract call
  // (trust-on-first-use) — it already lives in the ApiBorne admin as
  // `brandAuthorizationKey`, no need to copy it by hand. Set
  // SEED_KIOSK_AUTH_KEY to pin it explicitly.
  insertSetting.run("kioskAuthKey", process.env.SEED_KIOSK_AUTH_KEY ?? "");
  insertSetting.run("officeId", process.env.SEED_OFFICE_ID ?? "1");
  insertSetting.run(
    "officeVisibleId",
    process.env.SEED_OFFICE_VISIBLE_ID ?? "demo-office-visible-id",
  );
  insertSetting.run("brandId", process.env.SEED_BRAND_ID ?? "demo-brand");
  // Optional but recommended: the ApiBorne licence UUID (shown in the ApiBorne
  // admin, Connectivity page) identifies the target licence UNAMBIGUOUSLY in
  // the outbound pushes — several licences can share the same brandId.
  insertSetting.run("licenceUuid", process.env.SEED_LICENCE_UUID ?? "");
  insertSetting.run(
    "apiborneServerBaseUrl",
    process.env.SEED_APIBORNE_SERVER_BASE_URL ?? "http://localhost:3007",
  );
  insertSetting.run("pushEnabled", process.env.SEED_PUSH_ENABLED ?? "true");
  // false (default) = lenient: an unknown device presenting a VALID auth key is
  // auto-registered — convenient when the kiosk fleet is managed in the
  // ApiBorne admin (no duplicate provisioning here). true = strict contract
  // behaviour (unknown device -> 401 UNKNOWN_DEVICE), like EasyDoct.
  insertSetting.run("enforceKnownDevices", process.env.SEED_ENFORCE_KNOWN_DEVICES ?? "false");
  // Fuseau horaire du cabinet (IANA) : borne la journée « aujourd'hui » du
  // parcours borne (identify, by-ticket…). Sans lui, un serveur en UTC
  // (Render) cherche les RDV de la VEILLE entre minuit et 2 h heure française.
  insertSetting.run("officeTimezone", process.env.SEED_OFFICE_TIMEZONE ?? "Europe/Paris");
  // Clé(s) privée(s) du chiffrement de bout en bout (PEM concaténés, plus
  // récente en premier). Vide par défaut (mode clair tant qu'aucune clé) ;
  // le harnais e2e la seed pour tester le protocole chiffré complet.
  insertSetting.run(
    "contractEncryptionPrivateKeys",
    process.env.SEED_CONTRACT_ENCRYPTION_PRIVATE_KEYS ?? "",
  );
}
