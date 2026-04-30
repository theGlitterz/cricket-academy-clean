/**
 * AdminDashboard — Coach's home view.
 * Mobile-first. Shows today at a glance, clickable stat cards, upcoming sessions.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link, useLocation } from "wouter";
import {
  Clock,
  CheckCircle2,
  IndianRupee,
  CalendarDays,
  Settings,
  ChevronRight,
  Loader2,
  CalendarCheck,
  Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import AdminLayout from "./AdminLayout";
import { StatusBadge } from "@/components/StatusBadge";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = (h ?? 0) >= 12 ? "PM" : "AM";
  const hour = (h ?? 0) % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── Clickable Stat Card ──────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  colorClass,
  href,
  urgent,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  colorClass: string;
  href?: string;
  urgent?: boolean;
}) {
  const inner = (
    <div
      className={`rounded-2xl p-4 flex items-center gap-3 bg-white active:scale-[0.97] transition-transform ${urgent && Number(value) > 0 ? "ring-2 ring-yellow-400" : ""}`}
      style={{ border: "1px solid oklch(0.92 0.01 145)" }}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
      {href && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: stats, isLoading: statsLoading } = trpc.bookings.stats.useQuery();
  const { data: todayStats, isLoading: todayStatsLoading } = trpc.bookings.todayStats.useQuery();
  const { data: todayBookings, isLoading: todayLoading } = trpc.bookings.todayBookings.useQuery();

  const coachFirstName = user?.name?.split(" ")[0] ?? "Coach";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Next upcoming booking today (sorted by startTime)
  const sortedToday = todayBookings
    ? [...todayBookings].sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""))
    : [];
  const nextBooking = sortedToday.find((b) => b.bookingStatus === "confirmed");

  const isLoading = statsLoading || todayStatsLoading;

  return (
    <AdminLayout title="Dashboard">
      {/* ── Header ── */}
      <div className="mb-5">
        <p className="text-xs text-muted-foreground mb-0.5">{today}</p>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Welcome back, {coachFirstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Here's what's happening today</p>
      </div>

      {/* ── Today at a Glance ── */}
      {nextBooking ? (
        <Link href={`/admin/bookings/${nextBooking.id}`}>
          <div
            className="rounded-2xl p-4 mb-5 cursor-pointer active:scale-[0.98] transition-transform"
            style={{ background: "linear-gradient(135deg, oklch(0.22 0.08 145), oklch(0.32 0.12 145))" }}
          >
            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider mb-1">Next Session Today</p>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white truncate">{nextBooking.playerName}</p>
                <p className="text-xs text-white/70 mt-0.5">
                  {(nextBooking as any).serviceName ?? "Session"} · {formatTime(nextBooking.startTime)}{nextBooking.endTime ? ` – ${formatTime(nextBooking.endTime)}` : ""}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <div>
                    <p className="text-[10px] text-white/50">Advance Paid</p>
                    <p className="text-sm font-bold text-white">₹{Number((nextBooking as any).advance ?? 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-white/50">Remaining</p>
                    <p className="text-sm font-bold text-white">₹{Number((nextBooking as any).remaining ?? 0).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/50 mt-1 shrink-0" />
            </div>
          </div>
        </Link>
      ) : (
        <div
          className="rounded-2xl p-4 mb-5 text-center"
          style={{ background: "oklch(0.97 0.01 145)", border: "1px dashed oklch(0.85 0.04 145)" }}
        >
          <CalendarDays className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1.5" />
          <p className="text-sm text-muted-foreground font-medium">No confirmed sessions today</p>
        </div>
      )}

      {/* ── Stats Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            label="Today's Bookings"
            value={todayStats?.totalToday ?? 0}
            icon={<CalendarCheck className="w-5 h-5 text-green-600" />}
            colorClass="bg-green-100"
            href="/admin/bookings?date=today"
          />
          <StatCard
            label="Advance Collected"
            value={`₹${(todayStats?.advanceCollected ?? 0).toLocaleString("en-IN")}`}
            icon={<IndianRupee className="w-5 h-5 text-primary" />}
            colorClass="bg-primary/10"
          />
          <StatCard
            label="Open Slots Today"
            value={todayStats?.openSlots ?? 0}
            icon={<Clock className="w-5 h-5 text-blue-600" />}
            colorClass="bg-blue-100"
            href="/admin/slots"
          />
          <StatCard
            label="Booked Slots Today"
            value={todayStats?.bookedSlots ?? 0}
            icon={<CheckCircle2 className="w-5 h-5 text-orange-500" />}
            colorClass="bg-orange-100"
            href="/admin/slots"
          />
        </div>
      )}

      {/* ── Today's Sessions List ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Today's Sessions
          </p>
          <Link href="/admin/bookings?date=today">
            <span className="text-xs text-primary font-medium">All bookings →</span>
          </Link>
        </div>

        {todayLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : sortedToday.length > 0 ? (
          <div className="space-y-2">
            {sortedToday.map((b) => (
              <Link key={b.id} href={`/admin/bookings/${b.id}`}>
                <Card className="border border-border hover:border-primary/30 transition-colors cursor-pointer active:scale-[0.98]">
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{b.playerName}</p>
                          <StatusBadge status={b.bookingStatus as any} size="sm" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(b as any).serviceName ?? "Service"} · {b.startTime ? formatTime(b.startTime) : ""}
                          {b.endTime ? ` – ${formatTime(b.endTime)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
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
          <div className="rounded-2xl border border-dashed border-border p-5 text-center">
            <CalendarDays className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No bookings today yet.</p>
          </div>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Quick Actions
        </p>
        <div className="space-y-2">
          {[
            {
              href: "/admin/bookings",
              icon: <CalendarDays className="w-5 h-5 text-primary" />,
              label: "Manage All Bookings",
              desc: `${stats?.confirmed ?? 0} confirmed · ${stats?.total ?? 0} total`,
            },
            {
              href: "/admin/slots",
              icon: <Clock className="w-5 h-5 text-primary" />,
              label: "Manage Slots",
              desc: "Create, block, or delete time slots",
            },
            {
              href: "/admin/settings",
              icon: <Settings className="w-5 h-5 text-primary" />,
              label: "Facility Settings",
              desc: "Photos, amenities, contact info",
            },
          ].map(({ href, icon, label, desc }) => (
            <Link key={href} href={href}>
              <Card className="border border-border hover:border-primary/40 transition-colors cursor-pointer active:scale-[0.98]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
