/**
 * Internal UI API: the "Generate random appointments" button.
 * Creates N random scheduled appointments on the requested day, spread over
 * business hours across practitioners/rooms/exam types/patients.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  createAppointment,
  listExams,
  listExamTypes,
  listPatients,
  listPractitioners,
  listRooms,
} from "@/server/db/repositories";
import { toUiAppointment } from "../route";

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    date?: string; // YYYY-MM-DD (defaults to today)
    count?: number;
  } | null;
  const count = Math.min(Math.max(body?.count ?? 5, 1), 30);
  const baseDate = body?.date ? new Date(`${body.date}T00:00:00`) : new Date();

  const patients = listPatients();
  const practitioners = listPractitioners();
  const rooms = listRooms();
  const examTypes = listExamTypes();
  // Exams referential (configurable in /referentials): the generator picks a
  // real exam of the drawn type, falling back to the type name if none exists.
  const exams = listExams();
  if (patients.length === 0 || practitioners.length === 0 || examTypes.length === 0) {
    return NextResponse.json({ message: "reference data missing" }, { status: 400 });
  }

  const created = [];
  for (let i = 0; i < count; i++) {
    const examType = pick(examTypes);
    const typeExams = exams.filter((e) => e.exam_type_id === examType.id);
    const start = new Date(baseDate);
    // Business hours: 08:00 → 18:00, 10-minute grid.
    start.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 6) * 10, 0, 0);
    created.push(
      createAppointment({
        patientId: pick(patients).id,
        practitionerId: pick(practitioners).id,
        roomId: pick(rooms).id,
        officePlaceId: null,
        examTypeId: examType.id,
        examLabel: typeExams.length > 0 ? pick(typeExams).name : examType.name,
        startDate: start.toISOString(),
        durationMinutes: pick([20, 20, 30, 40]),
      }),
    );
  }
  return NextResponse.json({ appointments: created.map(toUiAppointment) }, { status: 201 });
}
