/**
 * Appointment status presentation — labels, colors and the receptionist's
 * allowed actions per status. The status VALUES are the contract enum.
 */
import type { AppointmentStatus } from "@/lib/api/client";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  checkedIn: "Checked in",
  inCare: "In care",
  done: "Done",
  cancelled: "Cancelled",
};

/** Card accent classes per status (left border + badge). */
export const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: "border-l-slate-400 bg-card",
  checkedIn: "border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/30",
  inCare: "border-l-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
  done: "border-l-zinc-400 bg-muted opacity-70",
  cancelled: "border-l-red-500 bg-red-50 opacity-60 dark:bg-red-950/30",
};

/**
 * Agenda actions offered on a card, per current status. `checkedIn` from the
 * agenda = "the receptionist marks the arrival" → triggers the ApiBorne
 * ticket issuance server-side. Every status also offers the BACKWARD step
 * (receptionist mistake), pushed to ApiBorne like any other change; going
 * back to `scheduled` keeps the already-issued ticket (re-arrival reuses it).
 */
export const NEXT_ACTIONS: Record<AppointmentStatus, { status: AppointmentStatus; label: string }[]> = {
  scheduled: [
    { status: "checkedIn", label: "Mark arrival (issue ticket)" },
    { status: "cancelled", label: "Cancel appointment" },
  ],
  checkedIn: [
    { status: "inCare", label: "Start care" },
    { status: "scheduled", label: "Undo arrival (back to scheduled)" },
    { status: "cancelled", label: "Cancel appointment" },
  ],
  inCare: [
    { status: "done", label: "Finish (done)" },
    { status: "checkedIn", label: "Back to checked in" },
  ],
  done: [{ status: "inCare", label: "Reopen (back to in care)" }],
  cancelled: [{ status: "scheduled", label: "Restore (back to scheduled)" }],
};
