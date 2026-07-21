/**
 * GET /config/exams — ApiBorne CONFIGURATION route (extension of the kiosk
 * contract). Exposes the individual exams referential (each belonging to an
 * exam type — same split as EasyDoct's Exam vs ExamType). Probed with the
 * other /config/* routes to validate the integration.
 *
 * Auth exception (server-to-server): ONLY `X-Kiosk-Auth-Key` is required.
 *
 * Response shape expected by ApiBorne:
 *   { "exams": [ { "id": "1", "name": "RADIO BASSIN", "examTypeId": "1" } ] }
 */
import type { NextRequest } from "next/server";
import { requireAuthKey } from "@/server/contract/auth";
import { ok, withErrorBoundary } from "@/server/contract/errors";
import { listExams } from "@/server/db/repositories";

export { corsOptions as OPTIONS } from "@/server/contract/cors";

export const GET = withErrorBoundary(async (request: NextRequest) => {
  const authError = requireAuthKey(request);
  if (authError) return authError;

  return ok({
    exams: listExams().map((exam) => ({
      id: String(exam.id),
      name: exam.name,
      examTypeId: String(exam.exam_type_id),
    })),
  });
});
