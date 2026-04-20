import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminLayout from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, UserPlus, ShieldAlert, Loader2,
  CheckCircle2, AlertCircle, ChevronDown, ChevronUp,
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

  const createAdmin = trpc.superAdmin.createFacilityAdmin.useMutation({
    onSuccess: () => {
      setSuccess("Facility admin account created. They can now log in at /admin/login.");
      setError(null);
      setForm({ email: "", name: "", password: "", facilityId: "" });
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

function FacilityList({ facilities, loading }: {
  facilities: { id: number; facilityName: string; coachName: string | null; address: string | null; isActive: boolean }[];
  loading: boolean;
}) {
  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (facilities.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">No facilities yet. Create one above.</p>;
  return (
    <div className="space-y-2">
      {facilities.map((f) => (
        <div key={f.id} className="flex items-start justify-between p-3 rounded-xl border border-border bg-card">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{f.facilityName}</span>
              <Badge variant={f.isActive ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                {f.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            {f.coachName && <p className="text-xs text-muted-foreground mt-0.5">{f.coachName}</p>}
            {f.address && <p className="text-xs text-muted-foreground">{f.address}</p>}
          </div>
          <span className="text-xs font-mono text-muted-foreground shrink-0 ml-3">ID: {f.id}</span>
        </div>
      ))}
    </div>
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
            <FacilityList facilities={facilities} loading={isLoading} />
          </CardContent>
        </Card>
        <CreateFacilityForm onCreated={handleFacilityCreated} />
        <CreateFacilityAdminForm facilities={facilities} />
      </div>
    </AdminLayout>
  );
}
