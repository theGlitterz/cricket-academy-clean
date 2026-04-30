/**
 * AdminBookings — Full booking list with status filter, date filter, and search.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ChevronRight, Search, CalendarDays, Phone, X } from "lucide-react";
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

function toDateStr(d: Date) {
  return d.toISOString().split("T")[0]!;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

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

function formatDisplayDate(d: string) {
  const today = toDateStr(new Date());
  const tomorrow = toDateStr(addDays(new Date(), 1));
  if (d === today) return "Today";
  if (d === tomorrow) return "Tomorrow";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Quick Date Chips ─────────────────────────────────────────────────────────
type DateChip = "today" | "tomorrow" | "weekend" | "next7" | "all";

const DATE_CHIPS: { value: DateChip; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "This Weekend" },
  { value: "next7", label: "Next 7 Days" },
  { value: "all", label: "All" },
];

function chipToDateFilter(chip: DateChip): string | undefined {
  const today = toDateStr(new Date());
  if (chip === "today") return today;
  if (chip === "tomorrow") return toDateStr(addDays(new Date(), 1));
  return undefined; // weekend, next7, all → handled client-side
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminBookings() {
  const todayStr = useMemo(() => toDateStr(new Date()), []);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateChip, setDateChip] = useState<DateChip>("today");
  const [customDate, setCustomDate] = useState<string>("");
  const [search, setSearch] = useState("");

  // Determine server-side date filter
  const serverDate = customDate || chipToDateFilter(dateChip);

  const { data: bookings, isLoading } = trpc.bookings.adminList.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    date: serverDate,
  });

  // Client-side post-filter for weekend / next7 / search
  const filtered = useMemo(() => {
    if (!bookings) return [];
    let result = bookings;

    // Weekend / next7 need client-side range filter (server returned all when date=undefined)
    if (!customDate) {
      if (dateChip === "weekend") {
        const today = new Date();
        const day = today.getDay(); // 0=Sun
        const daysUntilSat = (6 - day + 7) % 7;
        const sat = toDateStr(addDays(today, daysUntilSat === 0 ? 0 : daysUntilSat));
        const sun = toDateStr(addDays(today, daysUntilSat === 0 ? 1 : daysUntilSat + 1));
        result = result.filter((b) => b.bookingDate === sat || b.bookingDate === sun);
      } else if (dateChip === "next7") {
        const end = toDateStr(addDays(new Date(), 7));
        result = result.filter((b) => b.bookingDate && b.bookingDate >= todayStr && b.bookingDate <= end);
      }
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.playerName.toLowerCase().includes(q) ||
          b.playerWhatsApp.includes(q) ||
          b.referenceId.toLowerCase().includes(q) ||
          ((b as any).serviceName ?? "").toLowerCase().includes(q)
      );
    }

    // Sort by slot start time ascending when a specific date is active
    if (serverDate || dateChip === "today" || dateChip === "tomorrow") {
      result = [...result].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
    }

    return result;
  }, [bookings, dateChip, customDate, search, todayStr, serverDate]);

  // Active filter summary text
  const filterSummary = useMemo(() => {
    if (customDate) return `Showing bookings for ${formatDisplayDate(customDate)}`;
    if (dateChip === "today") return "Showing today's bookings";
    if (dateChip === "tomorrow") return "Showing tomorrow's bookings";
    if (dateChip === "weekend") return "Showing this weekend's bookings";
    if (dateChip === "next7") return "Showing next 7 days";
    return "Showing all bookings";
  }, [dateChip, customDate]);

  const clearFilters = () => {
    setDateChip("today");
    setCustomDate("");
    setStatusFilter("all");
    setSearch("");
  };

  const hasActiveFilters = dateChip !== "today" || customDate || statusFilter !== "all" || search;

  return (
    <AdminLayout title="Bookings">
      {/* ── Header ── */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Bookings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Review and manage bookings</p>
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

      {/* ── Date Quick Chips ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2 -mx-4 px-4">
        {DATE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => { setDateChip(chip.value); setCustomDate(""); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              dateChip === chip.value && !customDate
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {chip.label}
          </button>
        ))}
        {/* Custom date picker */}
        <input
          type="date"
          value={customDate}
          onChange={(e) => { setCustomDate(e.target.value); }}
          className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            customDate ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-muted-foreground"
          }`}
          title="Pick a specific date"
        />
      </div>

      {/* ── Status Filter Tabs ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-4 px-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Active Filter Summary ── */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">{filterSummary} · <span className="font-semibold text-foreground">{filtered.length}</span> result{filtered.length !== 1 ? "s" : ""}</p>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-primary font-medium">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* ── Booking List ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((b) => (
            <Link key={b.id} href={`/admin/bookings/${b.id}`}>
              <Card className="border border-border hover:border-primary/30 transition-all cursor-pointer active:scale-[0.98]">
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-2">
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
                        {(b as any).serviceName ?? "Service"} · {b.bookingDate ? formatDate(b.bookingDate) : ""} {b.startTime ? formatTime(b.startTime) : ""}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{b.referenceId}</p>
                    </div>
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
            {search ? "Try a different search term." : "No bookings for this filter."}
          </p>
          <button onClick={clearFilters} className="text-xs text-primary mt-2">
            Clear filters
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
