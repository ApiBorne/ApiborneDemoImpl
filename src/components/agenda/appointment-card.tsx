"use client";

/**
 * One appointment card positioned inside a practitioner column of the day
 * grid. The dropdown carries the receptionist actions (arrival, care, done,
 * cancel) — each action goes through /api/demo/appointments/{id}/status and
 * therefore through the ApiBorne notifications (see server/demo/actions.ts).
 */
import { FileText, MoreVertical, Pencil, Ticket, TicketX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AppointmentStatus, UiAppointment } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { NEXT_ACTIONS, STATUS_CLASSES, STATUS_LABELS } from "./status";

export function AppointmentCard({
  appointment,
  onChangeStatus,
  onEdit,
  onDocuments,
  onCancelTicket,
}: {
  appointment: UiAppointment;
  onChangeStatus: (id: number, status: AppointmentStatus) => void;
  onEdit: (appointment: UiAppointment) => void;
  onDocuments: (appointment: UiAppointment) => void;
  onCancelTicket: (appointment: UiAppointment) => void;
}) {
  const actions = NEXT_ACTIONS[appointment.status];
  const time = new Date(appointment.startDate).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div
      className={cn(
        "group flex h-full flex-col gap-0.5 overflow-hidden rounded-md border border-l-4 p-1.5 text-xs shadow-sm",
        STATUS_CLASSES[appointment.status],
      )}
    >
      <div className="flex items-center gap-1">
        <span className="font-semibold">{time}</span>
        <Badge variant="outline" className="px-1 py-0 text-[10px]">
          {STATUS_LABELS[appointment.status]}
        </Badge>
        {appointment.ticketNumberFormatted && (
          <span className="ml-auto inline-flex items-center gap-0.5 font-mono text-[10px] font-semibold">
            <Ticket className="size-3" />
            {appointment.ticketNumberFormatted}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className={cn("size-5", !appointment.ticketNumberFormatted && "ml-auto")}
              aria-label="Appointment actions"
            >
              <MoreVertical className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(appointment)}>
              <Pencil className="size-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDocuments(appointment)}>
              <FileText className="size-3.5" /> Documents & survey
            </DropdownMenuItem>
            {actions.length > 0 && <DropdownMenuSeparator />}
            {actions.map((action) => (
              <DropdownMenuItem
                key={action.status}
                onClick={() => onChangeStatus(appointment.id, action.status)}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
            {appointment.ticketNumberFormatted && (
              <>
                <DropdownMenuSeparator />
                {/* Void the ticket so the patient can redo the kiosk check-in —
                    while it exists, the kiosk answers "already checked in". */}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onCancelTicket(appointment)}
                >
                  <TicketX className="size-3.5" /> Cancel ticket (redo check-in)
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="truncate font-medium" title={appointment.patientName}>
        {appointment.patientName}
      </div>
      <div className="text-muted-foreground truncate" title={appointment.examLabel}>
        {appointment.examLabel}
      </div>
      {appointment.requiredDocumentTypes.length > 0 && (
        <div
          className={cn(
            "flex items-center gap-1 text-[10px] font-medium",
            appointment.missingDocumentTypes.length === 0
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400",
          )}
          title={
            appointment.missingDocumentTypes.length === 0
              ? "All required documents provided"
              : `Missing: ${appointment.missingDocumentTypes.join(", ")}`
          }
        >
          <FileText className="size-3" />
          {appointment.requiredDocumentTypes.length - appointment.missingDocumentTypes.length}/
          {appointment.requiredDocumentTypes.length} docs
          {appointment.checkinDocumentsComplete === false && (
            <span className="text-red-600 dark:text-red-400">· incomplete at check-in</span>
          )}
        </div>
      )}
    </div>
  );
}
