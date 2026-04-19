/**
 * AdminBookings — Full booking list with status filter tabs and search.
 * Coach can filter by status, search by name/phone/reference, and tap to review.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ChevronRight, Search, CalendarDays, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import AdminLayout from "./AdminLayout";
import { StatusBadge } from "@/components/StatusBadge";

// ─── Types & Helpers ──────────────────────────────────────────────────────────
type StatusFilter = "all" | "pending" | "confirmed" | "rejected" | "cancelled";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];


function formatTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = (h ?? 0) >= 12 ? "PM" : "AM";
  const hour = (h ?? 0) % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminBookings() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const { data: bookings, isLoading } = trpc.bookings.adminList.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  // Client-side search
  const filtered = bookings?.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      b.playerName.toLowerCase().includes(q) ||
      b.playerWhatsApp.includes(q) ||
      b.referenceId.toLowerCase().includes(q) ||
      ((b as any).serviceName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <AdminLayout title="Bookings">
      {/* ── Header ── */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Bookings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review and manage all booking requests
        </p>
      </div>

      {/* ── Search ── */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search name, WhatsApp, or reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 text-sm rounded-xl"
        />
      </div>

      {/* ── Status Filter Tabs ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 -mx-4 px-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Booking List ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered && filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((b) => (
            <Link key={b.id} href={`/admin/bookings/${b.id}`}>
              <Card className="border border-border hover:border-primary/30 transition-all cursor-pointer active:scale-[0.98]">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    {/* Left */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{b.playerName}</p>
                        <StatusBadge status={b.bookingStatus as any} size="sm" />
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">{b.playerWhatsApp}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(b as any).serviceName ?? "Service"} ·{" "}
                        {b.bookingDate ? formatDate(b.bookingDate) : ""}{" "}
                        {b.startTime ? formatTime(b.startTime) : ""}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                        {b.referenceId}
                      </p>
                    </div>
                    {/* Right */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <p className="text-sm font-bold text-primary">
                        ₹{parseFloat(String(b.amount)).toLocaleString("en-IN")}
                      </p>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <CalendarDays className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">No bookings found</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {search ? "Try a different search term." : "No bookings in this category yet."}
          </p>
          {statusFilter !== "all" && (
            <button onClick={() => setStatusFilter("all")} className="text-xs text-primary mt-2">
              Clear filter
            </button>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
