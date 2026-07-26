"use client";

/**
 * Create/edit appointment dialog. Create mode opens from an empty agenda slot
 * (practitioner + time pre-filled) ; edit mode opens from the card's "Edit"
 * action with every field editable, including the practitioner (moves the
 * card to another column). Pure demo tooling: pick an existing patient, exam
 * type, exam (from the configurable referential — sets the label), room, time
 * and duration. The exam label stays editable as a free-text fallback.
 */
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  UiAppointment,
  UiExam,
  UiExamType,
  UiOfficePlace,
  UiPatient,
  UiPractitioner,
  UiRoom,
} from "@/lib/api/client";

export interface CreateSlot {
  practitionerId: number;
  hour: number;
  minute: number;
}

export interface AppointmentDraft {
  patientId: number;
  practitionerId: number;
  roomId: number | null;
  /** Site of the appointment — feeds the contract `locationId` (wrong-site control). */
  officePlaceId: number | null;
  examTypeId: number;
  examLabel: string;
  startDate: string;
  durationMinutes: number;
}

export function CreateAppointmentDialog({
  slot,
  editing,
  date,
  patients,
  practitioners,
  rooms,
  officePlaces,
  examTypes,
  exams,
  onClose,
  onCreate,
  onUpdate,
}: {
  slot: CreateSlot | null;
  /** RDV en cours d'édition (mode édition) — exclusif de `slot`. */
  editing: UiAppointment | null;
  date: string; // YYYY-MM-DD of the displayed day
  patients: UiPatient[];
  practitioners: UiPractitioner[];
  rooms: UiRoom[];
  officePlaces: UiOfficePlace[];
  examTypes: UiExamType[];
  exams: UiExam[];
  onClose: () => void;
  onCreate: (data: AppointmentDraft) => void;
  onUpdate: (id: number, data: AppointmentDraft) => void;
}) {
  const [patientId, setPatientId] = useState<string>("");
  const [practitionerId, setPractitionerId] = useState<string>("");
  const [examTypeId, setExamTypeId] = useState<string>("");
  const [examId, setExamId] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [officePlaceId, setOfficePlaceId] = useState<string>("");
  const [examLabel, setExamLabel] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("20");

  // Re-sync the fields every time the dialog opens on a new slot.
  useEffect(() => {
    if (slot) {
      setTime(`${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`);
      setPatientId("");
      setPractitionerId(String(slot.practitionerId));
      setExamTypeId("");
      setExamId("");
      setRoomId("");
      setOfficePlaceId("");
      setExamLabel("");
      setDuration("20");
    }
  }, [slot]);

  // Pré-remplissage complet en mode édition.
  useEffect(() => {
    if (editing) {
      const start = new Date(editing.startDate);
      setTime(
        `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      );
      setPatientId(String(editing.patientId));
      setPractitionerId(String(editing.practitionerId));
      setExamTypeId(String(editing.examTypeId));
      setExamId("");
      setRoomId(editing.roomId != null ? String(editing.roomId) : "");
      setOfficePlaceId(editing.officePlaceId != null ? String(editing.officePlaceId) : "");
      setExamLabel(editing.examLabel);
      setDuration(String(editing.durationMinutes));
    }
  }, [editing]);

  const typeExams = exams.filter((e) => String(e.examTypeId) === examTypeId);
  const isEdit = editing !== null;

  function submit() {
    if ((!slot && !editing) || !patientId || !examTypeId || !practitionerId) {
      return;
    }
    const [hour = "9", minute = "0"] = time.split(":");
    // En édition on garde le JOUR du RDV existant (le dialog n'édite que l'heure)
    const baseDay = editing ? editing.startDate.slice(0, 10) : date;
    const startDate = new Date(`${baseDay}T12:00:00`);
    startDate.setHours(Number(hour), Number(minute), 0, 0);
    const examType = examTypes.find((e) => e.id === Number(examTypeId));
    const draft: AppointmentDraft = {
      patientId: Number(patientId),
      practitionerId: Number(practitionerId),
      roomId: roomId ? Number(roomId) : null,
      officePlaceId: officePlaceId ? Number(officePlaceId) : null,
      examTypeId: Number(examTypeId),
      examLabel: examLabel || examType?.name || "EXAM",
      startDate: startDate.toISOString(),
      durationMinutes: Number(duration) || 20,
    };
    if (editing) {
      onUpdate(editing.id, draft);
    } else {
      onCreate(draft);
    }
  }

  return (
    <Dialog open={slot !== null || editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit appointment" : "New appointment"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Patient</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.lastName} {p.firstName} ({p.birthDate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div className="space-y-1.5">
              <Label>Practitioner</Label>
              <Select value={practitionerId} onValueChange={setPractitionerId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {practitioners.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Exam type</Label>
              <Select
                value={examTypeId}
                onValueChange={(v) => {
                  setExamTypeId(v);
                  setExamId("");
                  const examType = examTypes.find((e) => e.id === Number(v));
                  if (examType && !examLabel) {
                    setExamLabel(examType.name);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {examTypes.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name} ({e.ticketPrefix})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Select value={roomId} onValueChange={setRoomId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Site du RDV : alimente `locationId` du contrat — c'est lui que la
              borne compare à son lieu pour le contrôle « mauvais site ».
              Vide = premier site du référentiel (mono-site historique). */}
          {officePlaces.length > 1 && (
            <div className="space-y-1.5">
              <Label>Location (site)</Label>
              <Select value={officePlaceId} onValueChange={setOfficePlaceId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={`Default — ${officePlaces[0]?.name ?? ""}`} />
                </SelectTrigger>
                <SelectContent>
                  {officePlaces.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {typeExams.length > 0 && (
            <div className="space-y-1.5">
              <Label>Exam</Label>
              <Select
                value={examId}
                onValueChange={(v) => {
                  setExamId(v);
                  const exam = typeExams.find((e) => e.id === Number(v));
                  if (exam) {
                    setExamLabel(exam.name);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick an exam (sets the label)" />
                </SelectTrigger>
                <SelectContent>
                  {typeExams.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Exam label</Label>
            <Input value={examLabel} onChange={(e) => setExamLabel(e.target.value)} placeholder="RADIO BASSIN" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input
                type="number"
                min={10}
                step={10}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!patientId || !examTypeId || !practitionerId}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
