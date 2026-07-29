"use client";

/**
 * Patients page — the demo dataset (all identities are fake). The NIR shown
 * here is what the kiosk sends to POST /patients/identify: copy one into the
 * kiosk (or a curl call) to exercise the identification flow.
 *
 * Create / edit / delete are demo tooling (internal UI API) — deleting a
 * patient also removes their appointments and attached documents.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import * as api from "@/lib/api/client";
import type { UiPatient } from "@/lib/api/client";

interface PatientForm {
  firstName: string;
  lastName: string;
  birthDate: string;
  nir: string;
  email: string;
  mobilePhone: string;
}

const EMPTY_FORM: PatientForm = {
  firstName: "",
  lastName: "",
  birthDate: "",
  nir: "",
  email: "",
  mobilePhone: "",
};

export default function PatientsPage() {
  const [open, setOpen] = useState(false);
  /** null = creation, otherwise the patient being edited. */
  const [editing, setEditing] = useState<UiPatient | null>(null);
  const [form, setForm] = useState<PatientForm>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<UiPatient | null>(null);
  const queryClient = useQueryClient();

  const patients = useQuery({ queryKey: ["patients"], queryFn: api.getPatients });

  const set = (field: keyof PatientForm) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((previous) => ({ ...previous, [field]: event.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (patient: UiPatient) => {
    setEditing(patient);
    setForm({
      firstName: patient.firstName ?? "",
      lastName: patient.lastName ?? "",
      birthDate: patient.birthDate ?? "",
      nir: patient.socialSecurityId ?? "",
      email: patient.email ?? "",
      mobilePhone: patient.mobilePhone ?? "",
    });
    setOpen(true);
  };

  const afterSave = (message: string) => {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    void queryClient.invalidateQueries({ queryKey: ["patients"] });
    toast.success(message);
  };

  const createMutation = useMutation({
    mutationFn: api.createPatient,
    onSuccess: () => afterSave("Patient created"),
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof api.updatePatient>[1] }) =>
      api.updatePatient(id, data),
    onSuccess: () => afterSave("Patient updated"),
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deletePatient(id),
    onSuccess: () => {
      setConfirmDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      void queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Patient deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const submit = () => {
    const nir = form.nir.replace(/\s+/g, "");
    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        data: {
          firstName: form.firstName,
          lastName: form.lastName,
          birthDate: form.birthDate,
          socialSecurityId: nir || null,
          email: form.email || null,
          mobilePhone: form.mobilePhone || null,
        },
      });
    } else {
      createMutation.mutate({
        firstName: form.firstName,
        lastName: form.lastName,
        birthDate: form.birthDate,
        ...(nir ? { socialSecurityId: nir } : {}),
      });
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Patients</h1>
        <Button className="ml-auto" onClick={openCreate}>
          <Plus className="size-4" /> New patient
        </Button>
      </div>

      {patients.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Last name</TableHead>
                <TableHead>First name</TableHead>
                <TableHead>Birth date</TableHead>
                <TableHead>Social security id (fake NIR)</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mobile phone</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(patients.data?.patients ?? []).map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium">{patient.lastName}</TableCell>
                  <TableCell>{patient.firstName}</TableCell>
                  <TableCell>{patient.birthDate}</TableCell>
                  <TableCell className="font-mono text-xs">{patient.socialSecurityId}</TableCell>
                  <TableCell className="text-muted-foreground">{patient.email}</TableCell>
                  {/* Kiosk-editable: updated by PATCH /patients/{id} from the identity screen */}
                  <TableCell className="text-muted-foreground">{patient.mobilePhone}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit patient"
                        onClick={() => openEdit(patient)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete patient"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(patient)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit patient" : "New patient"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name</Label>
                <Input value={form.firstName} onChange={set("firstName")} />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input value={form.lastName} onChange={set("lastName")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Birth date</Label>
              <Input type="date" value={form.birthDate} onChange={set("birthDate")} />
            </div>
            <div className="space-y-1.5">
              <Label>Social security id (fake)</Label>
              <Input value={form.nir} onChange={set("nir")} />
            </div>
            {editing && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={set("email")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Mobile phone</Label>
                  <Input value={form.mobilePhone} onChange={set("mobilePhone")} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!form.firstName || !form.lastName || !form.birthDate || saving}
              onClick={submit}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete !== null} onOpenChange={(next) => !next && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete patient</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Delete {confirmDelete?.firstName} {confirmDelete?.lastName}? Their appointments and
            attached documents will be deleted too.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
