/**
 * AdminLayout — shared wrapper for all admin pages.
 * Dark cricket-green sidebar on desktop, slide-down drawer on mobile.
 * Auth-gated: requires logged-in user with role=admin.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Layers,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";



import { Button } from "@/components/ui/button";

// ─── Nav Items ────────────────────────────────────────────────────────────────
const BASE_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/admin/slots", label: "Slots", icon: Clock },
  { href: "/admin/services", label: "Services", icon: Layers },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];



const SUPER_ADMIN_NAV = { href: "/admin/super", label: "Platform", icon: ShieldCheck };


// ─── Sidebar background color ─────────────────────────────────────────────────
const SIDEBAR_BG = "oklch(0.20 0.08 145)";
const SIDEBAR_ACTIVE = "oklch(0.38 0.13 145)";
const SIDEBAR_TEXT = "rgba(255,255,255,0.65)";
const SIDEBAR_TEXT_ACTIVE = "white";
const SIDEBAR_BORDER = "rgba(255,255,255,0.08)";

// ─── Cricket ball SVG logo ────────────────────────────────────────────────────
function CricketLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="white" opacity="0.15" />
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="1.5" fill="none" />
      <path d="M7 12 Q12 4 17 12" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M7 12 Q12 20 17 12" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminLayout({ children, title }: AdminLayoutProps) {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Not logged in: redirect to /admin/login ──
  if (!isAuthenticated) {
    const returnTo = encodeURIComponent(window.location.pathname);
    window.location.href = `/admin/login?returnTo=${returnTo}`;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ── Not admin or super admin ──
  if (user?.role !== "admin" && user?.role !== "super_admin" && user?.role !== "facility_admin") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 gap-4 bg-background">
        <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
          <ShieldAlert className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-bold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Your account ({user?.email ?? user?.name}) does not have admin privileges.
            Contact the facility owner to get access.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => logout()}>Sign Out</Button>
          <Link href="/"><Button variant="ghost" size="sm">← Back to Home</Button></Link>
        </div>
      </div>
    );
  }

  // ── Admin shell ──
  const NAV_ITEMS = user?.role === "super_admin"
    ? [...BASE_NAV_ITEMS, SUPER_ADMIN_NAV]
    : BASE_NAV_ITEMS;
  const currentNav = NAV_ITEMS.find((n) => n.href === location);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top Bar ── */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-4 h-14"
        style={{ background: SIDEBAR_BG, borderBottom: `1px solid ${SIDEBAR_BORDER}` }}
      >
        {/* Logo + Brand */}
        <Link href="/admin">
          <div className="flex items-center gap-2.5 cursor-pointer">
            <CricketLogo />
            <div>
              <p className="text-xs font-bold text-white leading-none" style={{ fontFamily: "Syne, sans-serif" }}>
                BCA Admin
              </p>
              <p className="text-[10px] leading-none mt-0.5" style={{ color: "rgba(255,255,255,0.40)" }}>
                {title ?? currentNav?.label ?? "Dashboard"}
              </p>
            </div>
          </div>
        </Link>

        {/* Desktop: user info + sign out */}
        <div className="hidden sm:flex items-center gap-3">
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.50)" }}>{user?.name}</span>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors"
            style={{ color: "rgba(255,255,255,0.50)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "white"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.50)"; }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>

        {/* Mobile: hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
          style={{ color: "white" }}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </header>

      {/* ── Mobile Nav Drawer ── */}
      {menuOpen && (
        <div
          className="sm:hidden fixed top-14 left-0 right-0 z-40"
          style={{ background: "oklch(0.22 0.08 145)", borderBottom: `1px solid ${SIDEBAR_BORDER}` }}
        >
          <nav className="px-3 py-2 space-y-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = location === href;
              return (
                <Link key={href} href={href}>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
                    style={{
                      background: isActive ? SIDEBAR_ACTIVE : "transparent",
                      color: isActive ? SIDEBAR_TEXT_ACTIVE : SIDEBAR_TEXT,
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                </Link>
              );
            })}
            <div className="pt-1 mt-1" style={{ borderTop: `1px solid ${SIDEBAR_BORDER}` }}>
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                <LogOut className="w-4 h-4" />
                Sign Out ({user?.name})
              </button>
              <Link href="/">
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors"
                  style={{ color: "rgba(255,255,255,0.30)" }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Booking Site
                </button>
              </Link>
            </div>
          </nav>
        </div>
      )}

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex flex-1">
        {/* Desktop Sidebar */}
        <aside
          className="hidden sm:flex flex-col w-56 min-h-[calc(100vh-56px)] sticky top-14 shrink-0"
          style={{ background: SIDEBAR_BG, borderRight: `1px solid ${SIDEBAR_BORDER}` }}
        >
          <nav className="flex-1 p-3 space-y-0.5">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = location === href;
              return (
                <Link key={href} href={href}>
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150"
                    style={{
                      background: isActive ? SIDEBAR_ACTIVE : "transparent",
                      color: isActive ? SIDEBAR_TEXT_ACTIVE : SIDEBAR_TEXT,
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                </Link>
              );
            })}
          </nav>
          <div className="p-3 space-y-0.5" style={{ borderTop: `1px solid ${SIDEBAR_BORDER}` }}>
            <Link href="/">
              <button
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors"
                style={{ color: "rgba(255,255,255,0.30)" }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View Booking Site
              </button>
            </Link>
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="max-w-2xl mx-auto px-4 py-6 pb-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
