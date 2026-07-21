"use client";

/**
 * Settings page — intentionally minimal: everything that CAN be automatic IS
 * automatic, so the only knobs left are the two ApiBorne-server pointers:
 *
 *  - the ApiBorne LICENCE UUID (copied from the ApiBorne admin, Connectivity
 *    page): identifies the target licence unambiguously in the outbound
 *    notifications;
 *  - the ApiBorne server base URL (+ a toggle for the outbound pushes);
 *  - a reset button to reseed the demo database.
 *
 * NOT configurable here (by design):
 *  - the shared auth key is captured from the first contract call
 *    (trust-on-first-use) — it already lives in the ApiBorne admin;
 *  - kiosk devices are managed in the ApiBorne admin and auto-registered on
 *    first contact;
 *  - the office identity (officeId / brandId) is seeded from .env.local and
 *    only used as a legacy fallback when no licence UUID is set.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import * as api from "@/lib/api/client";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data.settings;
      setValues({
        licenceUuid: s.licenceUuid ?? "",
        apiborneServerBaseUrl: s.apiborneServerBaseUrl ?? "",
        pushEnabled: s.pushEnabled ?? "true",
      });
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => api.saveSettings({ settings: values }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const resetMutation = useMutation({
    mutationFn: api.resetDemoData,
    onSuccess: () => {
      void queryClient.invalidateQueries();
      toast.success("Demo data reset to the seeded state");
    },
    onError: (error) => toast.error(error.message),
  });

  if (settingsQuery.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>ApiBorne server</CardTitle>
          <CardDescription>
            Used for the outbound notifications (issueForAppointment: agenda arrivals share the
            kiosk ticket sequence; appointmentStatusChanged: Cockpit live updates). Both are
            best-effort: the agenda keeps working if the server is down. The shared auth key is
            captured automatically from the first contract call and kiosk devices are
            auto-registered — nothing else to configure here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>ApiBorne licence UUID</Label>
            <Input
              value={values.licenceUuid ?? ""}
              onChange={set("licenceUuid")}
              placeholder="Shown in the ApiBorne admin (Connectivity page)"
            />
            <p className="text-muted-foreground text-xs">
              Identifies the target licence unambiguously — several licences can share the same
              brand. Copy it from the ApiBorne admin, Connectivity page.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>ApiBorne server base URL</Label>
            <Input
              value={values.apiborneServerBaseUrl ?? ""}
              onChange={set("apiborneServerBaseUrl")}
              placeholder="http://localhost:3007"
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>Send outbound notifications</Label>
            <Switch
              checked={values.pushEnabled !== "false"}
              onCheckedChange={(checked) =>
                setValues((v) => ({ ...v, pushEnabled: checked ? "true" : "false" }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          Save settings
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button
          variant="outline"
          className="text-destructive"
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
        >
          Reset demo data
        </Button>
      </div>
    </div>
  );
}
