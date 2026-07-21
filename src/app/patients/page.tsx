"use client";

/**
 * Patients page — the demo dataset (all identities are fake). The NIR shown
 * here is what the kiosk sends to POST /patients/identify: copy one into the
 * kiosk (or a curl call) to exercise the identification flow.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
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

export default function PatientsPage() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nir, setNir] = useState("");
  const queryClient = useQueryClient();

  const patients = useQuery({ queryKey: ["patients"], queryFn: api.getPatients });

  const createMutation = useMutation({
    mutationFn: api.createPatient,
    onSuccess: () => {
      setOpen(false);
      setFirstName("");
      setLastName("");
      setBirthDate("");
      setNir("");
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Patient created");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold">Patients</h1>
        <Button className="ml-auto" onClick={() => setOpen(true)}>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Birth date</Label>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Social security id (fake)</Label>
              <Input value={nir} onChange={(e) => setNir(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!firstName || !lastName || !birthDate || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({
                  firstName,
                  lastName,
                  birthDate,
                  ...(nir ? { socialSecurityId: nir.replace(/\s+/g, "") } : {}),
                })
              }
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
