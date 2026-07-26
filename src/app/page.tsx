"use client";

/**
 * Agenda page (day view) — the demo's main screen.
 *
 * What to look at as an integrator:
 *  - the "Mark arrival" action on a card → POST /api/demo/appointments/{id}/status
 *    → src/server/demo/actions.ts → the ApiBorne `issueForAppointment` +
 *    `appointmentStatusChanged` calls (the shared ticket sequence in action);
 *  - a kiosk check-in (through the contract routes) makes the ticket appear
 *    here on the next refresh — both worlds converge on the same rows.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, Shuffle } from "lucide-react";
import { toast } from "sonner";
import { AppointmentDocumentsDialog } from "@/components/agenda/appointment-documents-dialog";
import {
  CreateAppointmentDialog,
  type CreateSlot,
} from "@/components/agenda/create-appointment-dialog";
import { DayGrid } from "@/components/agenda/day-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api/client";

function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AgendaPage() {
  const [date, setDate] = useState(() => toDateInput(new Date()));
  const [slot, setSlot] = useState<CreateSlot | null>(null);
  const [editing, setEditing] = useState<api.UiAppointment | null>(null);
  const [documentsAppointmentId, setDocumentsAppointmentId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const reference = useQuery({ queryKey: ["reference"], queryFn: api.getReference });
  const appointments = useQuery({
    queryKey: ["appointments", date],
    queryFn: () => api.getAppointments(date),
    refetchInterval: 5000, // poll: kiosk check-ins and Cockpit changes show up
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["appointments", date] });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: api.AppointmentStatus }) =>
      api.changeStatus(id, status),
    onSuccess: (data) => {
      invalidate();
      const t = data.appointment.ticketNumberFormatted;
      toast.success(
        t && data.appointment.status === "checkedIn"
          ? `Arrival marked — ticket ${t}`
          : `Status: ${data.appointment.status}`,
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const createMutation = useMutation({
    mutationFn: api.createAppointment,
    onSuccess: () => {
      setSlot(null);
      invalidate();
      toast.success("Appointment created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.updateAppointment>[1] }) =>
      api.updateAppointment(id, data),
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast.success("Appointment updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const cancelTicketMutation = useMutation({
    mutationFn: (id: number) => api.cancelTicket(id),
    onSuccess: () => {
      invalidate();
      toast.success("Ticket cancelled — the patient can redo the kiosk check-in");
    },
    onError: (error) => toast.error(error.message),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.generateAppointments(date, 5),
    onSuccess: (data) => {
      invalidate();
      toast.success(`${data.appointments.length} random appointments generated`);
    },
    onError: (error) => toast.error(error.message),
  });

  const patients = useQuery({ queryKey: ["patients"], queryFn: api.getPatients });

  const shiftDay = (delta: number) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() + delta);
    setDate(toDateInput(d));
  };

  const dayLabel = useMemo(
    () =>
      new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [date],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">Agenda</h1>
        <span className="text-muted-foreground text-sm">{dayLabel}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => shiftDay(-1)} aria-label="Previous day">
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            className="w-40"
            value={date}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <Button variant="outline" size="icon-sm" onClick={() => shiftDay(1)} aria-label="Next day">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => setDate(toDateInput(new Date()))}>
            Today
          </Button>
          <Button
            variant="outline"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            <Shuffle className="size-4" /> Generate random appointments
          </Button>
          <Button
            onClick={() => setSlot({ practitionerId: reference.data?.practitioners[0]?.id ?? 1, hour: 9, minute: 0 })}
          >
            <Plus className="size-4" /> New
          </Button>
        </div>
      </div>

      {reference.isLoading || appointments.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <DayGrid
          practitioners={reference.data?.practitioners ?? []}
          appointments={appointments.data?.appointments ?? []}
          onSlotClick={(practitionerId, hour, minute) => setSlot({ practitionerId, hour, minute })}
          onChangeStatus={(id, status) => statusMutation.mutate({ id, status })}
          onEdit={(appointment) => setEditing(appointment)}
          onDocuments={(appointment) => setDocumentsAppointmentId(appointment.id)}
          onCancelTicket={(appointment) => cancelTicketMutation.mutate(appointment.id)}
        />
      )}

      <AppointmentDocumentsDialog
        appointment={
          appointments.data?.appointments.find((a) => a.id === documentsAppointmentId) ?? null
        }
        documentTypes={reference.data?.documentTypes ?? []}
        onClose={() => setDocumentsAppointmentId(null)}
        onChanged={invalidate}
      />

      <CreateAppointmentDialog
        slot={slot}
        editing={editing}
        date={date}
        patients={patients.data?.patients ?? []}
        practitioners={reference.data?.practitioners ?? []}
        rooms={reference.data?.rooms ?? []}
        officePlaces={reference.data?.officePlaces ?? []}
        examTypes={reference.data?.examTypes ?? []}
        exams={reference.data?.exams ?? []}
        onClose={() => {
          setSlot(null);
          setEditing(null);
        }}
        onCreate={(data) => createMutation.mutate(data)}
        onUpdate={(id, data) => updateMutation.mutate({ id, data })}
      />
    </div>
  );
}
