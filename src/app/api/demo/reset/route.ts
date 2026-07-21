/**
 * Internal UI API: reset the database to its seeded state (the /settings page
 * "Reset demo data" button).
 */
import { NextResponse } from "next/server";
import { resetAndReseed } from "@/server/db/db";

export function POST(): NextResponse {
  resetAndReseed();
  return NextResponse.json({ ok: true });
}
