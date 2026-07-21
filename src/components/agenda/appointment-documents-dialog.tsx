"use client";

/**
 * Documents dialog of an appointment (agenda ⋮ menu → "Documents & survey").
 *
 * The demo's "patient file" management, mirroring what the kiosk sees through
 * the contract:
 *  - REQUIRED document types of this appointment (editable — served to the
 *    kiosk as `requiredDocumentTypes` by GET /appointments/{id}/documents);
 *  - attached documents (kiosk uploads land here too), with page previews,
 *    manual add (with or without an image file) and delete — adding the last
 *    missing type is what flips the kiosk's check-in conditions to "complete";
 *  - preparatory-survey state (contract `preparatorySurveyCompleted`);
 *  - the check-in trace: the `documentsComplete` boolean reported by the kiosk.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Paperclip, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import * as api from "@/lib/api/client";

/** Read image files as { contentBase64, mimeType } pages (data: prefix stripped). */
async function filesToPages(files: File[]): Promise<{ contentBase64: string; mimeType: string }[]> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<{ contentBase64: string; mimeType: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              contentBase64: String(reader.result).replace(/^data:[^;]+;base64,/, ""),
              mimeType: file.type === "image/png" ? "image/png" : "image/jpeg",
            });
          reader.onerror = () => reject(new Error(`Cannot read ${file.name}`));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export function AppointmentDocumentsDialog({
  appointment,
  documentTypes,
  onClose,
  onChanged,
}: {
  appointment: api.UiAppointment | null;
  /** Référentiel des types de documents (éditable dans /referentials). */
  documentTypes: api.UiDocumentType[];
  onClose: () => void;
  /** Called after any change so the agenda refreshes its cards. */
  onChanged: () => void;
}) {
  const labelOf = (code: string) =>
    documentTypes.find((t) => t.code === code)?.label ?? code;
  const queryClient = useQueryClient();
  const appointmentId = appointment?.id ?? null;

  const documentsQuery = useQuery({
    queryKey: ["documents", appointmentId],
    queryFn: () => api.getAppointmentDocuments(appointmentId!),
    enabled: appointmentId != null,
  });

  const [addType, setAddType] = useState<string>("prescription");
  const [requiredToAdd, setRequiredToAdd] = useState<string>("");
  const [preview, setPreview] = useState<api.UiDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["documents", appointmentId] });
    onChanged();
  };
  const onError = (error: Error) => toast.error(error.message);

  const requiredMutation = useMutation({
    mutationFn: (types: string[]) => api.setRequiredDocumentTypes(appointmentId!, types),
    onSuccess: refresh,
    onError,
  });
  const surveyMutation = useMutation({
    mutationFn: (completed: boolean | null) => api.setPreparatorySurvey(appointmentId!, completed),
    onSuccess: () => {
      onChanged();
      toast.success("Survey state saved");
    },
    onError,
  });
  const addDocumentMutation = useMutation({
    mutationFn: async () => {
      const files = Array.from(fileInputRef.current?.files ?? []);
      return api.addAppointmentDocument(appointmentId!, {
        documentType: addType,
        ...(files.length > 0 ? { pages: await filesToPages(files) } : {}),
      });
    },
    onSuccess: () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      refresh();
      toast.success("Document attached");
    },
    onError,
  });
  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: number) => api.deleteAppointmentDocument(appointmentId!, documentId),
    onSuccess: () => {
      setPreview(null);
      refresh();
    },
    onError,
  });

  if (!appointment) {
    return null;
  }

  const documents = documentsQuery.data?.documents ?? [];
  const requiredTypes = documentsQuery.data?.requiredDocumentTypes ?? appointment.requiredDocumentTypes;
  const providedTypes = new Set(documents.map((d) => d.documentType));
  const availableToRequire = documentTypes.filter((d) => !requiredTypes.includes(d.code));

  const surveyValue =
    appointment.preparatorySurveyCompleted == null
      ? "none"
      : appointment.preparatorySurveyCompleted
        ? "done"
        : "pending";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            Documents — {appointment.patientName}
          </DialogTitle>
          <DialogDescription>
            {appointment.examLabel} ·{" "}
            {new Date(appointment.startDate).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </DialogDescription>
        </DialogHeader>

        {/* Check-in trace: the kiosk-reported `documentsComplete` boolean. */}
        {appointment.checkinDocumentsComplete != null && (
          <div
            className={
              appointment.checkinDocumentsComplete
                ? "rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            }
          >
            Kiosk check-in reported the patient file as{" "}
            <strong>{appointment.checkinDocumentsComplete ? "complete" : "incomplete"}</strong>.
          </div>
        )}

        {/* Required document types (editable per appointment). */}
        <div className="space-y-2">
          <Label>Required documents for this appointment</Label>
          <div className="flex flex-wrap gap-1.5">
            {requiredTypes.length === 0 && (
              <span className="text-muted-foreground text-sm">None — the kiosk will not ask for documents.</span>
            )}
            {requiredTypes.map((type) => (
              <Badge
                key={type}
                variant="outline"
                className={
                  providedTypes.has(type)
                    ? "border-emerald-400 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-400 text-amber-700 dark:text-amber-300"
                }
              >
                {providedTypes.has(type) ? <Check className="size-3" /> : <X className="size-3" />}
                {labelOf(type)}
                <button
                  type="button"
                  aria-label={`Remove ${type}`}
                  className="hover:text-destructive ml-0.5"
                  onClick={() => requiredMutation.mutate(requiredTypes.filter((t) => t !== type))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Select value={requiredToAdd} onValueChange={setRequiredToAdd}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Add a required document type…" />
              </SelectTrigger>
              <SelectContent>
                {availableToRequire.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              disabled={!requiredToAdd || requiredMutation.isPending}
              onClick={() => {
                requiredMutation.mutate([...requiredTypes, requiredToAdd]);
                setRequiredToAdd("");
              }}
            >
              Require
            </Button>
          </div>
        </div>

        <Separator />

        {/* Preparatory survey (contract preparatorySurveyCompleted). */}
        <div className="flex items-center justify-between gap-2">
          <Label>Preparatory survey</Label>
          <Select
            value={surveyValue}
            onValueChange={(value) =>
              surveyMutation.mutate(value === "none" ? null : value === "done")
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not expected</SelectItem>
              <SelectItem value="pending">Expected — not filled</SelectItem>
              <SelectItem value="done">Filled ✓</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Attached documents (kiosk uploads + manual additions). */}
        <div className="space-y-2">
          <Label>Attached documents ({documents.length})</Label>
          {documents.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No document yet — the kiosk uploads land here, or attach one below.
            </p>
          )}
          <div className="space-y-1.5">
            {documents.map((document) => (
              <div key={document.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <button
                  type="button"
                  className="shrink-0"
                  title="Preview pages"
                  onClick={() => setPreview(preview?.id === document.id ? null : document)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={document.pages[0]}
                    alt={document.label}
                    className="bg-muted h-12 w-9 rounded border object-cover"
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{document.label}</div>
                  <div className="text-muted-foreground text-xs">
                    {labelOf(document.documentType)} · {document.pageCount} page(s) ·{" "}
                    {new Date(document.createdAt).toLocaleString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete document"
                  className="text-destructive"
                  onClick={() => deleteDocumentMutation.mutate(document.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
          {preview && (
            <div className="space-y-2 rounded-md border p-2">
              <div className="text-muted-foreground text-xs">{preview.label} — pages</div>
              <div className="flex flex-wrap gap-2">
                {preview.pages.map((page, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={index}
                    src={page}
                    alt={`Page ${index + 1}`}
                    className="bg-muted max-h-72 rounded border"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Manual add: type + optional image scan(s). */}
        <div className="space-y-2 rounded-md border p-3">
          <Label className="flex items-center gap-1.5">
            <Paperclip className="size-3.5" /> Attach a document
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={addType} onValueChange={setAddType}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((d) => (
                  <SelectItem key={d.code} value={d.code}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              multiple
              className="text-sm"
            />
            <Button
              size="sm"
              disabled={addDocumentMutation.isPending}
              onClick={() => addDocumentMutation.mutate()}
            >
              Add
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Without a file, a placeholder page is stored — enough to mark the document as
            provided and satisfy the kiosk&apos;s check-in conditions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
