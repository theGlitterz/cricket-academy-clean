import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Save, Loader2, Building2, Phone, MapPin } from "lucide-react";
import AdminLayout from "./AdminLayout";

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border border-border rounded-2xl">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        <div className="space-y-3">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function AdminSettings() {
  const { data: facility, isLoading } = trpc.facility.getForAdmin.useQuery();
  const settings = facility;
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    facilityName: "",
    coachName: "",
    coachWhatsApp: "",
    address: "",
    workingHours: "",
    googleMapsUrl: "",
  });


  useEffect(() => {
    if (facility) {
        setForm({
        facilityName: facility.facilityName ?? "",
        coachName: facility.coachName ?? "",
        coachWhatsApp: facility.coachWhatsApp ?? "",
        address: facility.address ?? "",
        workingHours: facility.workingHours ?? "",
        googleMapsUrl: facility.googleMapsUrl ?? "",
      });

    }
  }, [facility]);

  const updateMutation = trpc.facility.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved!");
      utils.facility.getForAdmin.invalidate();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const handleSave = () => {
    updateMutation.mutate({
      facilityName: form.facilityName || undefined,
      coachName: form.coachName || undefined,
      coachWhatsApp: form.coachWhatsApp || undefined,
      address: form.address || undefined,
      workingHours: form.workingHours || undefined,
      googleMapsUrl: form.googleMapsUrl || undefined,
    });

  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  if (isLoading) {
    return (
      <AdminLayout title="Settings">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Settings">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
            Facility Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure your facility details and payment info
          </p>
        </div>
        <Button
          className="rounded-xl gap-2"
          onClick={handleSave}
          disabled={updateMutation.isPending}
          size="sm"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </Button>
      </div>

      <div className="space-y-4">
        {/* ── Facility Info ── */}
        <Section icon={Building2} title="Facility Info">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Facility Name</Label>
            <Input value={form.facilityName} onChange={set("facilityName")} className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Coach Name</Label>
              <Input
                value={form.coachName}
                onChange={set("coachName")}
                placeholder="Coach Ramesh"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Working Hours</Label>
              <Input
                value={form.workingHours}
                onChange={set("workingHours")}
                placeholder="6AM–10AM, 3PM–9PM"
                className="rounded-xl"
              />
            </div>
          </div>
        </Section>

        {/* ── Contact ── */}
        <Section icon={Phone} title="Contact">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Coach WhatsApp</Label>
            <Input
              type="tel"
              value={form.coachWhatsApp}
              onChange={set("coachWhatsApp")}
              placeholder="+919876543210"
              className="rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">Include country code. Players will contact you on this number.</p>
          </div>
        </Section>

        {/* ── Location ── */}
        <Section icon={MapPin} title="Location">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Address</Label>
            <Textarea
              value={form.address}
              onChange={set("address")}
              rows={2}
              placeholder="Full address shown on booking page"
              className="rounded-xl resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Google Maps URL</Label>
            <Input
              value={form.googleMapsUrl}
              onChange={set("googleMapsUrl")}
              placeholder="https://maps.google.com/..."
              className="rounded-xl"
            />
          </div>
        </Section>

        {/* ── Save Button (bottom) ── */}
        <Button
          className="w-full rounded-xl h-12 text-base font-semibold"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" />Saving...</>
          ) : (
            <><Save className="w-5 h-5 mr-2" />Save All Settings</>
          )}
        </Button>
      </div>
    </AdminLayout>
  );
}
