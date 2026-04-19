/**
 * AdminDashboard — Coach's home view.
 * Shows today's bookings, live stats, pending review list, and quick actions.
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import {
  Clock,
  CheckCircle2,
  XCircle,
  BarChart3,
  ChevronRight,
  CalendarDays,
  Settings,
  Loader2,
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

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon,
  colorClass,
  urgent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-4 flex items-center gap-3 bg-white ${urgent && value > 0 ? "ring-2 ring-yellow-400" : ""}`}
      style={{ border: "1px solid oklch(0.92 0.01 145)" }}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = trpc.bookings.stats.useQuery();
  const { data: pendingBookings, isLoading: pendingLoading } = trpc.bookings.adminList.useQuery({ status: "pending" });
  const { data: todayBookings, isLoading: todayLoading } = trpc.bookings.todayBookings.useQuery();

  const coachFirstName = user?.name?.split(" ")[0] ?? "Coach";
  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <AdminLayout title="Dashboard">
      {/* ── Header ── */}
      <div className="mb-5">
        <p className="text-xs text-muted-foreground mb-0.5">{today}</p>
        <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Welcome back, {coachFirstName} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Here's what's happening at BestCricketAcademy
        </p>
      </div>

      {/* ── Stats Grid ── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard
            label="Pending Review"
            value={stats?.pending ?? 0}
            icon={<Clock className="w-5 h-5 text-yellow-600" />}
            colorClass="bg-yellow-100"
            urgent
          />
          <StatCard
            label="Confirmed"
            value={stats?.confirmed ?? 0}
            icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
            colorClass="bg-green-100"
          />
          <StatCard
            label="Rejected"
            value={stats?.rejected ?? 0}
            icon={<XCircle className="w-5 h-5 text-red-500" />}
            colorClass="bg-red-100"
          />
          <StatCard
            label="Total Bookings"
            value={stats?.total ?? 0}
            icon={<BarChart3 className="w-5 h-5 text-primary" />}
            colorClass="bg-primary/10"
          />
        </div>
      )}

      {/* ── Pending Review Section ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Needs Your Review
            </p>
            {(pendingBookings?.length ?? 0) > 0 && (
              <span className="bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingBookings?.length}
              </span>
            )}
          </div>
          <Link href="/admin/bookings">
            <span className="text-xs text-primary font-medium">View all →</span>
          </Link>
        </div>

        {pendingLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : pendingBookings && pendingBookings.length > 0 ? (
          <div className="space-y-2">
            {pendingBookings.slice(0, 4).map((b) => (
              <Link key={b.id} href={`/admin/bookings/${b.id}`}>
                <Card
                  className="cursor-pointer active:scale-[0.98] transition-all"
                  style={{ border: "1px solid oklch(0.88 0.08 85)", background: "oklch(0.99 0.02 85)" }}
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{b.playerName}</p>
                          <StatusBadge status="pending" size="sm" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {b.serviceName ?? "Service"} · {formatDate(b.bookingDate)} {b.startTime ? formatTime(b.startTime) : ""}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{b.referenceId}</p>
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
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-foreground">All caught up!</p>
            <p className="text-xs text-muted-foreground mt-0.5">No pending bookings to review.</p>
          </div>
        )}
      </div>

      {/* ── Today's Sessions ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Today's Sessions
          </p>
          <Link href="/admin/bookings">
            <span className="text-xs text-primary font-medium">All bookings →</span>
          </Link>
        </div>

        {todayLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : todayBookings && todayBookings.length > 0 ? (
          <div className="space-y-2">
            {todayBookings.map((b) => (
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
                          {b.serviceName ?? "Service"} · {b.startTime ? formatTime(b.startTime) : ""}{b.endTime ? ` – ${formatTime(b.endTime)}` : ""}
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
            <p className="text-sm text-muted-foreground">No sessions booked for today.</p>
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
              desc: `${stats?.pending ?? 0} pending · ${stats?.confirmed ?? 0} confirmed`,
            },
            {
              href: "/admin/slots",
              icon: <Clock className="w-5 h-5 text-primary" />,
              label: "Manage Slots",
              desc: "Create or block time slots",
            },
            {
              href: "/admin/settings",
              icon: <Settings className="w-5 h-5 text-primary" />,
              label: "Facility Settings",
              desc: "UPI, QR code, contact info",
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
