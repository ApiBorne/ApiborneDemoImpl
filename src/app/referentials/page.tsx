"use client";

/**
 * Referential management — practitioners, rooms, exam types and exams (the
 * data exposed to ApiBorne through the GET /config/* routes). Pure demo
 * tooling: inline edit + guarded delete (rows referenced by appointments
 * cannot be removed, the API answers 409 with a readable message).
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import * as api from "@/lib/api/client";
import type { ReferentialKind, UiExamType } from "@/lib/api/client";

/** One editable row: local draft state + save/delete actions. */
function Row({
  values,
  fields,
  examTypes,
  onSave,
  onDelete,
}: {
  values: Record<string, string>;
  fields: FieldDef[];
  examTypes: UiExamType[];
  onSave: (draft: Record<string, string>) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState(values);
  useEffect(() => setDraft(values), [values]);

  return (
    <div className="flex items-center gap-2">
      {fields.map((field) =>
        field.type === "examType" ? (
          <Select
            key={field.key}
            value={draft[field.key] ?? ""}
            onValueChange={(v) => setDraft((d) => ({ ...d, [field.key]: v }))}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {examTypes.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : field.type === "check" ? (
          <label
            key={field.key}
            title={field.placeholder}
            className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs"
          >
            <input
              type="checkbox"
              checked={draft[field.key] === "true"}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [field.key]: e.target.checked ? "true" : "false" }))
              }
            />
            tél.
          </label>
        ) : field.type === "color" ? (
          <Input
            key={field.key}
            type="color"
            className="h-8 w-12 shrink-0 p-1"
            value={draft[field.key] ?? "#6366f1"}
            onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
          />
        ) : (
          <Input
            key={field.key}
            className={`h-8 text-xs ${field.narrow ? "w-20 shrink-0" : "flex-1"}`}
            placeholder={field.placeholder}
            value={draft[field.key] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
          />
        ),
      )}
      <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => onSave(draft)}>
        {onDelete ? <Save className="size-3.5" /> : <Plus className="size-3.5" />}
      </Button>
      {onDelete && (
        <Button
          variant="outline"
          size="icon"
          className="text-destructive size-8 shrink-0"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

interface FieldDef {
  key: string;
  placeholder: string;
  type?: "text" | "color" | "examType" | "check";
  narrow?: boolean;
}

function ReferentialCard({
  kind,
  title,
  description,
  fields,
  rows,
  examTypes,
  emptyDraft,
}: {
  kind: ReferentialKind;
  title: string;
  description: string;
  fields: FieldDef[];
  rows: { id: number; values: Record<string, string> }[];
  examTypes: UiExamType[];
  emptyDraft: Record<string, string>;
}) {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["reference"] });
  const onError = (error: Error) => toast.error(error.message);

  const createMutation = useMutation({
    mutationFn: (draft: Record<string, string>) => api.createReferential(kind, draft),
    onSuccess: invalidate,
    onError,
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: Record<string, string> }) =>
      api.updateReferential(kind, id, draft),
    onSuccess: () => {
      invalidate();
      toast.success("Saved");
    },
    onError,
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteReferential(kind, id),
    onSuccess: invalidate,
    onError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <Row
            key={row.id}
            values={row.values}
            fields={fields}
            examTypes={examTypes}
            onSave={(draft) => updateMutation.mutate({ id: row.id, draft })}
            onDelete={() => deleteMutation.mutate(row.id)}
          />
        ))}
        <Row
          key={`new-${rows.length}`}
          values={emptyDraft}
          fields={fields}
          examTypes={examTypes}
          onSave={(draft) => createMutation.mutate(draft)}
        />
      </CardContent>
    </Card>
  );
}

export default function ReferentialsPage() {
  const reference = useQuery({ queryKey: ["reference"], queryFn: api.getReference });

  if (reference.isLoading || !reference.data) {
    return <Skeleton className="h-96 w-full" />;
  }
  const { practitioners, rooms, officePlaces, examTypes, exams, documentTypes } = reference.data;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Referentials</h1>
      <p className="text-muted-foreground text-sm">
        This reference data is exposed to the ApiBorne server through the contract
        configuration routes (GET /config/practitioners, /config/rooms,
        /config/exam-types, /config/exams, /config/office-places).
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReferentialCard
          kind="practitioners"
          title="Practitioners"
          description="Agenda columns — exposed via GET /config/practitioners"
          fields={[
            { key: "fullName", placeholder: "Dr Full NAME" },
            { key: "rppsId", placeholder: "RPPS id", narrow: true },
            { key: "color", placeholder: "", type: "color" },
          ]}
          rows={practitioners.map((p) => ({
            id: p.id,
            values: { fullName: p.fullName, rppsId: p.rppsId ?? "", color: p.color },
          }))}
          examTypes={examTypes}
          emptyDraft={{ fullName: "", rppsId: "", color: "#6366f1" }}
        />
        <ReferentialCard
          kind="rooms"
          title="Rooms"
          description="Exam rooms — exposed via GET /config/rooms"
          fields={[{ key: "name", placeholder: "Room name" }]}
          rows={rooms.map((r) => ({ id: r.id, values: { name: r.name } }))}
          examTypes={examTypes}
          emptyDraft={{ name: "" }}
        />
        <ReferentialCard
          kind="officePlaces"
          title="Office places"
          description="Sites / waiting areas — exposed via GET /config/office-places (shared with ApiBorne devices, boards and per-place ticket counters)"
          fields={[{ key: "name", placeholder: "Site name" }]}
          rows={officePlaces.map((p) => ({ id: p.id, values: { name: p.name } }))}
          examTypes={examTypes}
          emptyDraft={{ name: "" }}
        />
        <ReferentialCard
          kind="examTypes"
          title="Exam types"
          description="Ticket prefix feeds the call ticket format — GET /config/exam-types"
          fields={[
            { key: "name", placeholder: "RADIO" },
            { key: "ticketPrefix", placeholder: "RA", narrow: true },
          ]}
          rows={examTypes.map((e) => ({
            id: e.id,
            values: { name: e.name, ticketPrefix: e.ticketPrefix },
          }))}
          examTypes={examTypes}
          emptyDraft={{ name: "", ticketPrefix: "" }}
        />
        <ReferentialCard
          kind="exams"
          title="Exams"
          description="Individual exams, each belonging to an exam type — GET /config/exams"
          fields={[
            { key: "name", placeholder: "RADIO BASSIN" },
            { key: "examTypeId", placeholder: "Type", type: "examType" },
          ]}
          rows={exams.map((e) => ({
            id: e.id,
            values: { name: e.name, examTypeId: String(e.examTypeId) },
          }))}
          examTypes={examTypes}
          emptyDraft={{ name: "", examTypeId: "" }}
        />
        <ReferentialCard
          kind="documentTypes"
          title="Document types"
          description="THE editor-owned referential behind required documents — exposed via GET /config/document-types. Reuse the contract's standard codes when one matches; add your own codes freely. It only BUILDS the list: custom labels and phone availability are configured in the ApiBorne admin."
          fields={[
            { key: "code", placeholder: "prescription", narrow: true },
            { key: "label", placeholder: "Ordonnance" },
          ]}
          rows={documentTypes.map((t) => ({
            id: t.id,
            values: { code: t.code, label: t.label },
          }))}
          examTypes={examTypes}
          emptyDraft={{ code: "", label: "" }}
        />
      </div>
    </div>
  );
}
