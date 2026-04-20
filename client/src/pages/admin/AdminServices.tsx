/**
 * AdminServices — manage services and pricing for the current facility.
 * Uses trpc.services.listAll (admin-scoped) and trpc.services.upsert.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pencil, Plus, Loader2, CheckCircle2, AlertCircle, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: string;
  activeStatus: boolean;
  sortOrder: number;
}

const EMPTY_FORM = {
  id: undefined as number | undefined,
  slug: "",
  name: "",
  description: "",
  durationMinutes: 60,
  price: "",
  activeStatus: true,
  sortOrder: 0,
};

// ─── Service Form (inline modal) ──────────────────────────────────────────────

function ServiceForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: typeof EMPTY_FORM;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const upsert = trpc.services.upsert.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
    onError: (err) => setError(err.message),
  });

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.slug.trim() || !form.name.trim() || !form.price.trim()) return;
    upsert.mutate({
      id: form.id,
      slug: form.slug.trim(),
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      durationMinutes: Number(form.durationMinutes),
      price: form.price.trim(),
      activeStatus: form.activeStatus,
      sortOrder: Number(form.sortOrder),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base text-foreground">
            {form.id ? "Edit Service" : "New Service"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="svcName">Name *</Label>
            <Input id="svcName" value={form.name}
              onChange={(e) => set("name", e.target.value)} required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="svcSlug">Slug * <span className="text-xs text-muted-foreground">(URL-safe, e.g. ground-booking)</span></Label>
            <Input id="svcSlug" value={form.slug}
              onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="svcDesc">Description</Label>
            <Input id="svcDesc" value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="svcPrice">Price (₹) *</Label>
              <Input id="svcPrice" type="number" min="0" step="0.01" value={form.price}
                onChange={(e) => set("price", e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="svcDuration">Duration (min) *</Label>
              <Input id="svcDuration" type="number" min="15" step="15" value={form.durationMinutes}
                onChange={(e) => set("durationMinutes", Number(e.target.value))} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="svcSort">Sort Order</Label>
              <Input id="svcSort" type="number" value={form.sortOrder}
                onChange={(e) => set("sortOrder", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <div className="flex items-center gap-2 h-9">
                <input
                  id="svcActive"
                  type="checkbox"
                  checked={form.activeStatus}
                  onChange={(e) => set("activeStatus", e.target.checked)}
                  className="w-4 h-4 accent-primary"
                />
                <label htmlFor="svcActive" className="text-sm text-foreground cursor-pointer">
                  Active
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={upsert.isPending}>
              {upsert.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" />Save</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminServices() {
  const utils = trpc.useUtils();
  const { data: services = [], isLoading } = trpc.services.listAll.useQuery();
  const [editTarget, setEditTarget] = useState<typeof EMPTY_FORM | null>(null);

  const openNew = () => setEditTarget({ ...EMPTY_FORM });
  const openEdit = (s: ServiceRow) =>
    setEditTarget({
      id: s.id,
      slug: s.slug,
      name: s.name,
      description: s.description ?? "",
      durationMinutes: s.durationMinutes,
      price: s.price,
      activeStatus: s.activeStatus,
      sortOrder: s.sortOrder,
    });

  const handleSaved = () => utils.services.listAll.invalidate();

  return (
    <AdminLayout title="Services">
      {editTarget && (
        <ServiceForm
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}

      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
              Services
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage the services and pricing shown on the booking page.
            </p>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-4 h-4 mr-1.5" />New Service
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : services.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No services yet. Click "New Service" to add one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <Card key={s.id}>
                <CardHeader className="py-3 px-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-sm font-semibold text-foreground">
                          {s.name}
                        </CardTitle>
                        <Badge
                          variant={s.activeStatus ? "default" : "secondary"}
                          className="text-[10px] px-1.5 py-0"
                        >
                          {s.activeStatus ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {s.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>₹{s.price}</span>
                        <span>·</span>
                        <span>{s.durationMinutes} min</span>
                        <span>·</span>
                        <span className="font-mono">{s.slug}</span>
                        <span>·</span>
                        <span>order: {s.sortOrder}</span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => openEdit(s)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />Edit
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
