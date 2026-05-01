import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminLayout from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, UserPlus, ShieldAlert, Loader2,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Trash2, X, Users, Pencil,
} from "lucide-react";

function CreateFacilityForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ facilityName: "", coachName: "", coachWhatsApp: "", address: "" });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createFacility = trpc.facility.create.useMutation({
    onSuccess: (data) => {
      setSuccess(`Facility created with ID ${data.id}. You can now create a facility_admin for it.`);
      setError(null);
      setForm({ facilityName: "", coachName: "", coachWhatsApp: "", address: "" });
      onCreated();
    },
    onError: (err) => { setError(err.message); setSuccess(null); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.facilityName.trim()) return;
    setSuccess(null); setError(null);
    createFacility.mutate({
      facilityName: form.facilityName.trim(),
      coachName: form.coachName.trim() || undefined,
      coachWhatsApp: form.coachWhatsApp.trim() || undefined,
      address: form.address.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Add New Facility</CardTitle>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
        {!open && <CardDescription>Click to expand and create a new cricket facility.</CardDescription>}
      </CardHeader>
      {open && (
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="facilityName">Facility Name *</Label>
              <Input id="facilityName" placeholder="e.g. BestCricketAcademy Pune" value={form.facilityName}
                onChange={(e) => setForm((f) => ({ ...f, facilityName: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coachName">Coach Name</Label>
              <Input id="coachName" placeholder="e.g. Coach Suresh Patel" value={form.coachName}
                onChange={(e) => setForm((f) => ({ ...f, coachName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="coachWhatsApp">Coach WhatsApp</Label>
              <Input id="coachWhatsApp" placeholder="+919876543210" value={form.coachWhatsApp}
                onChange={(e) => setForm((f) => ({ ...f, coachWhatsApp: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" placeholder="City, State" value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            {success && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 text-green-800 text-sm">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />{success}
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
              </div>
            )}
            <Button type="submit" disabled={createFacility.isPending} className="w-full">
              {createFacility.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create Facility"}
            </Button>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

function CreateFacilityAdminForm({ facilities }: { facilities: { id: number; facilityName: string }[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", facilityId: "" });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

   const utils = trpc.useUtils();
  const createAdmin = trpc.superAdmin.createFacilityAdmin.useMutation({
    onSuccess: (data) => {
      if (data.reassigned) {
        setSuccess("Existing admin reassigned to the selected facility. Their password is unchanged.");
      } else {
        setSuccess("Facility admin account created. They can now log in at /admin/login.");
      }
      setError(null);
      setForm({ email: "", name: "", password: "", facilityId: "" });
      utils.superAdmin.listAdmins.invalidate();
    },
    onError: (err) => { setError(err.message); setSuccess(null); },
  });


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.name || !form.password || !form.facilityId) return;
    setSuccess(null); setError(null);
    createAdmin.mutate({
      email: form.email.trim(),
      name: form.name.trim(),
      password: form.password,
      facilityId: parseInt(form.facilityId, 10),
    });
  };

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Create Facility Admin Account</CardTitle>
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
        {!open && <CardDescription>Click to expand and assign an admin to a facility.</CardDescription>}
      </CardHeader>
      {open && (
        <CardContent>
          {facilities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No facilities found. Create a facility first.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="adminFacility">Assign to Facility *</Label>
                <select id="adminFacility"
                  className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.facilityId} onChange={(e) => setForm((f) => ({ ...f, facilityId: e.target.value }))} required>
                  <option value="">Select a facility…</option>
                  {facilities.map((f) => (
                    <option key={f.id} value={String(f.id)}>{f.facilityName} (ID: {f.id})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminName">Admin Full Name *</Label>
                <Input id="adminName" placeholder="e.g. Coach Ravi Kumar" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminEmail">Admin Email *</Label>
                <Input id="adminEmail" type="email" placeholder="coach@facility.com" value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminPassword">Temporary Password *</Label>
                <Input id="adminPassword" type="password" placeholder="Min. 8 characters" value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} minLength={8} required />
                <p className="text-xs text-muted-foreground">Share this with the coach — they should change it after first login.</p>
              </div>
              {success && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 text-green-800 text-sm">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />{success}
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{error}
                </div>
              )}
              <Button type="submit" disabled={createAdmin.isPending} className="w-full">
                {createAdmin.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</> : "Create Facility Admin"}
              </Button>
            </form>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function FacilityList({
  facilities,
  loading,
  onDeleted,
}: {
  facilities: { id: number; facilityName: string; coachName: string | null; address: string | null; coachWhatsApp?: string | null; googleMapsUrl?: string | null; isActive: boolean }[];
  loading: boolean;
  onDeleted?: () => void;
}) {
  const utils = trpc.useUtils();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ facilityName: "", coachName: "", coachWhatsApp: "", address: "", googleMapsUrl: "" });

  const deleteMutation = trpc.facility.delete.useMutation({
    onSuccess: () => { toast.success("Facility deleted"); onDeleted?.(); },
    onError: (err) => toast.error(err.message ?? "Failed to delete facility"),
    onSettled: () => setDeletingId(null),
  });

  const updateMutation = trpc.facility.update.useMutation({
    onSuccess: () => {
      toast.success("Facility updated.");
      setEditingId(null);
      utils.facility.listAll.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Failed to update facility"),
  });

  const startEdit = (f: typeof facilities[0]) => {
    setEditForm({
      facilityName: f.facilityName ?? "",
      coachName: f.coachName ?? "",
      coachWhatsApp: (f as { coachWhatsApp?: string | null }).coachWhatsApp ?? "",
      address: f.address ?? "",
      googleMapsUrl: (f as { googleMapsUrl?: string | null }).googleMapsUrl ?? "",
    });
    setEditingId(f.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (facilities.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No facilities yet. Create one above.</p>;
  }
  return (
    <div className="space-y-2">
      {facilities.map((f) => (
        <div key={f.id} className="rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between p-3 gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-foreground">{f.facilityName}</span>
                <Badge variant={f.isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                  {f.isActive ? "Active" : "Inactive"}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">ID: {f.id}</span>
              </div>
              {f.coachName && <p className="text-xs text-muted-foreground mt-0.5">{f.coachName}</p>}
              {f.address && <p className="text-xs text-muted-foreground">{f.address}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => editingId === f.id ? setEditingId(null) : startEdit(f)}
                title="Edit facility"
              >
                {editingId === f.id ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              </Button>
              {f.id !== 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                  disabled={deletingId === f.id}
                  onClick={() => {
                    if (confirm(`Delete "${f.facilityName}"? This cannot be undone.`)) {
                      setDeletingId(f.id);
                      deleteMutation.mutate({ id: f.id });
                    }
                  }}
                >
                  {deletingId === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              )}
            </div>
          </div>
          {editingId === f.id && (
            <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Facility Name</Label>
                  <Input value={editForm.facilityName} onChange={(e) => setEditForm((p) => ({ ...p, facilityName: e.target.value }))} className="rounded-lg h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Coach Name</Label>
                  <Input value={editForm.coachName} onChange={(e) => setEditForm((p) => ({ ...p, coachName: e.target.value }))} className="rounded-lg h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Coach WhatsApp</Label>
                <Input value={editForm.coachWhatsApp} onChange={(e) => setEditForm((p) => ({ ...p, coachWhatsApp: e.target.value }))} placeholder="+919876543210" className="rounded-lg h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Address</Label>
                <Textarea value={editForm.address} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} rows={2} className="rounded-lg text-sm resize-none" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Google Maps URL</Label>
                <Input value={editForm.googleMapsUrl} onChange={(e) => setEditForm((p) => ({ ...p, googleMapsUrl: e.target.value }))} placeholder="https://maps.google.com/..." className="rounded-lg h-8 text-sm" />
              </div>
              <Button
                size="sm"
                className="w-full rounded-lg"
                disabled={updateMutation.isPending}
                onClick={( ) => updateMutation.mutate({
                  id: f.id,
                  facilityName: editForm.facilityName || undefined,
                  coachName: editForm.coachName || undefined,
                  coachWhatsApp: editForm.coachWhatsApp || undefined,
                  address: editForm.address || undefined,
                  googleMapsUrl: editForm.googleMapsUrl || undefined,
                })}
              >
                {updateMutation.isPending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}



function FacilityAdminsPanel({ facilities }: { facilities: { id: number; facilityName: string }[] }) {
  const utils = trpc.useUtils();
  const { data: admins = [], isLoading } = trpc.superAdmin.listAdmins.useQuery();
  const [removingId, setRemovingId] = useState<number | null>(null);

  const removeMutation = trpc.superAdmin.removeAdmin.useMutation({
    onSuccess: () => {
      toast.success("Admin removed.");
      utils.superAdmin.listAdmins.invalidate();
    },
    onError: (err) => toast.error(err.message ?? "Failed to remove admin"),
    onSettled: () => setRemovingId(null),
  });

  const facilityName = (id: number | null) =>
    id == null ? "—" : (facilities.find((f) => f.id === id)?.facilityName ?? `Facility #${id}`);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Facility Admins</CardTitle>
        </div>
        <CardDescription>{admins.length} admin{admins.length !== 1 ? "s" : ""} registered</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No facility admins yet.</p>
        ) : (
          <div className="space-y-2">
            {admins.map((admin) => (
              <div key={admin.id} className="flex items-start justify-between p-3 rounded-xl border border-border bg-card gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{admin.name ?? admin.email}</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">{admin.role}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{admin.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Facility: <span className="font-medium">{facilityName(admin.facilityId)}</span>
                    {admin.createdAt && (
                      <span className="ml-2 text-[11px]">
                        · Created {new Date(admin.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0 shrink-0"
                  disabled={removingId === admin.id}
                  onClick={() => {
                    if (confirm(`Remove admin "${admin.email}"? They will lose all access.`)) {
                      setRemovingId(admin.id);
                      removeMutation.mutate({ userId: admin.id });
                    }
                  }}
                >
                  {removingId === admin.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function SuperAdmin() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: facilities = [], isLoading } = trpc.facility.listAll.useQuery();

  const handleFacilityCreated = () => { utils.facility.listAll.invalidate(); };

  if (user && user.role !== "super_admin") {
    return (
      <AdminLayout title="Super Admin">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <ShieldAlert className="w-10 h-10 text-red-400" />
          <p className="text-sm text-muted-foreground text-center">This page is only accessible to the platform super admin.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Super Admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>Platform Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all facilities and admin accounts on the platform.</p>
        </div>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">All Facilities</CardTitle>
            </div>
            <CardDescription>{facilities.length} facilit{facilities.length === 1 ? "y" : "ies"} registered</CardDescription>
          </CardHeader>
          <CardContent>
          <FacilityList facilities={facilities} loading={isLoading} onDeleted={handleFacilityCreated} />
          </CardContent>
        </Card>
               <FacilityAdminsPanel facilities={facilities} />
        <CreateFacilityForm onCreated={handleFacilityCreated} />
        <CreateFacilityAdminForm facilities={facilities} />

      </div>
    </AdminLayout>
  );
}
