/**
 * Internal UI API: patients list + creation (used by the /patients page and
 * the create-appointment dialog).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createPatient, listPatients } from "@/server/db/repositories";

function toUiPatient(p: ReturnType<typeof listPatients>[number]) {
  return {
    id: p.id,
    firstName: p.first_name,
    lastName: p.last_name,
    birthDate: p.birth_date,
    socialSecurityId: p.social_security_id,
    email: p.email,
    phone: p.phone,
    mobilePhone: p.mobile_phone,
    city: p.city,
    referringPractitionerName: p.referring_practitioner_name,
  };
}

export function GET(): NextResponse {
  return NextResponse.json({ patients: listPatients().map(toUiPatient) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    socialSecurityId?: string;
  } | null;
  if (!body?.firstName || !body?.lastName || !body?.birthDate) {
    return NextResponse.json(
      { message: "firstName, lastName and birthDate are required" },
      { status: 400 },
    );
  }
  const patient = createPatient({
    firstName: body.firstName,
    lastName: body.lastName,
    birthDate: body.birthDate,
    socialSecurityId: body.socialSecurityId ?? null,
  });
  return NextResponse.json({ patient: toUiPatient(patient) }, { status: 201 });
}
