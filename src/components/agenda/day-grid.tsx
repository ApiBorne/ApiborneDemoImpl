"use client";

/**
 * Day view: an hours × practitioners grid (08:00 → 18:00), built with plain
 * divs + absolute positioning — no calendar library, so the whole rendering
 * is readable in one file. Clicking an empty slot opens the create dialog
 * with the practitioner and time pre-filled.
 */
import { AppointmentCard } from "@/components/agenda/appointment-card";
import type { AppointmentStatus, UiAppointment, UiPractitioner } from "@/lib/api/client";

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;
const PIXELS_PER_MINUTE = 1.6; // 96 px per hour

function minutesFromDayStart(iso: string): number {
  const d = new Date(iso);
  return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
}

export function DayGrid({
  practitioners,
  appointments,
  onSlotClick,
  onChangeStatus,
  onEdit,
  onDocuments,
  onCancelTicket,
}: {
  practitioners: UiPractitioner[];
  appointments: UiAppointment[];
  onSlotClick: (practitionerId: number, hour: number, minute: number) => void;
  onChangeStatus: (id: number, status: AppointmentStatus) => void;
  onEdit: (appointment: UiAppointment) => void;
  onDocuments: (appointment: UiAppointment) => void;
  onCancelTicket: (appointment: UiAppointment) => void;
}) {
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
  const gridHeight = (DAY_END_HOUR - DAY_START_HOUR) * 60 * PIXELS_PER_MINUTE;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="flex min-w-[720px]">
        {/* Hour gutter */}
        <div className="bg-muted/40 w-14 shrink-0 border-r">
          <div className="h-10 border-b" />
          <div className="relative" style={{ height: gridHeight }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="text-muted-foreground absolute w-full pr-2 text-right text-xs"
                style={{ top: (hour - DAY_START_HOUR) * 60 * PIXELS_PER_MINUTE - 7 }}
              >
                {hour > DAY_START_HOUR ? `${String(hour).padStart(2, "0")}:00` : ""}
              </div>
            ))}
          </div>
        </div>

        {/* One column per practitioner */}
        {practitioners.map((practitioner) => {
          const columnAppointments = appointments.filter(
            (a) => a.practitionerId === practitioner.id,
          );
          return (
            <div key={practitioner.id} className="min-w-56 flex-1 border-r last:border-r-0">
              <div
                className="flex h-10 items-center justify-center gap-2 border-b text-sm font-semibold"
                style={{ borderTopColor: practitioner.color }}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: practitioner.color }} />
                {practitioner.fullName}
              </div>
              <div className="relative" style={{ height: gridHeight }}>
                {/* Clickable half-hour slots */}
                {hours.flatMap((hour) =>
                  [0, 30].map((minute) => (
                    <button
                      key={`${hour}:${minute}`}
                      type="button"
                      aria-label={`Create appointment at ${hour}:${String(minute).padStart(2, "0")}`}
                      className="hover:bg-accent/40 absolute w-full border-b border-dashed border-transparent transition-colors [&:nth-child(odd)]:border-border/40"
                      style={{
                        top: ((hour - DAY_START_HOUR) * 60 + minute) * PIXELS_PER_MINUTE,
                        height: 30 * PIXELS_PER_MINUTE,
                      }}
                      onClick={() => onSlotClick(practitioner.id, hour, minute)}
                    />
                  )),
                )}
                {/* Hour lines */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-border/60 pointer-events-none absolute w-full border-b"
                    style={{ top: (hour - DAY_START_HOUR) * 60 * PIXELS_PER_MINUTE }}
                  />
                ))}
                {/* Appointment cards */}
                {columnAppointments.map((appointment) => {
                  const top = minutesFromDayStart(appointment.startDate) * PIXELS_PER_MINUTE;
                  // Hauteur mini 64px : l'en-tête + patient + examen restent
                  // lisibles même pour un RDV de 20 minutes
                  const height = Math.max(appointment.durationMinutes * PIXELS_PER_MINUTE, 64);
                  return (
                    <div
                      key={appointment.id}
                      className="absolute right-1 left-1 z-10"
                      style={{ top, height }}
                    >
                      <AppointmentCard
                        onDocuments={onDocuments}
                        onCancelTicket={onCancelTicket}
                        appointment={appointment}
                        onChangeStatus={onChangeStatus}
                        onEdit={onEdit}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
