/**
 * Internal UI API: settings + known kiosk devices. Backed by the `settings`
 * and `kiosk_devices` tables; seeded from .env.local on first start.
 * The /settings UI only exposes licenceUuid / apiborneServerBaseUrl /
 * pushEnabled — the other keys stay editable through this API (curl) for
 * advanced scenarios (pinning the auth key, strict device mode…).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  listDevices,
  listSettings,
  replaceDevices,
  setSetting,
} from "@/server/db/repositories";
import type { SettingKey } from "@/server/db/types";

const EDITABLE_KEYS: SettingKey[] = [
  "kioskAuthKey",
  "officeId",
  "officeVisibleId",
  "brandId",
  "licenceUuid",
  "apiborneServerBaseUrl",
  "pushEnabled",
  "enforceKnownDevices",
  "contractEncryptionPrivateKeys",
];

export function GET(): NextResponse {
  return NextResponse.json({
    settings: listSettings(),
    deviceIds: listDevices().map((d) => d.device_id),
  });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    settings?: Record<string, string>;
    deviceIds?: string[];
  } | null;
  if (!body) {
    return NextResponse.json({ message: "invalid body" }, { status: 400 });
  }
  for (const key of EDITABLE_KEYS) {
    const value = body.settings?.[key];
    if (typeof value === "string") {
      setSetting(key, value);
    }
  }
  if (Array.isArray(body.deviceIds)) {
    replaceDevices(body.deviceIds.map((s) => s.trim()).filter(Boolean));
  }
  return NextResponse.json({
    settings: listSettings(),
    deviceIds: listDevices().map((d) => d.device_id),
  });
}
