import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  MapPin,
  Clock,
  Phone,
  ChevronRight,
  CheckCircle2,
  CalendarDays,
  CreditCard,
  Zap,
  Star,
} from "lucide-react";

// ─── Service icons (SVG-based, no emoji) ─────────────────────────────────────
function GroundIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="currentColor" opacity="0.12" />
      <ellipse cx="20" cy="26" rx="10" ry="4" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
      <path d="M14 22 Q20 10 26 22" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="20" cy="14" r="2" fill="currentColor" />
    </svg>
  );
}
function NetIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="currentColor" opacity="0.12" />
      <rect x="10" y="12" width="20" height="16" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.5" />
      <line x1="10" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="10" y1="20" x2="30" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="10" y1="24" x2="30" y2="24" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="15" y1="12" x2="15" y2="28" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="20" y1="12" x2="20" y2="28" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <line x1="25" y1="12" x2="25" y2="28" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      <circle cx="28" cy="20" r="3" fill="currentColor" />
    </svg>
  );
}
function CoachIcon() {
  return (
    <svg viewBox="0 0 40 40" fill="none" className="w-full h-full" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="currentColor" opacity="0.12" />
      <circle cx="20" cy="14" r="5" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M10 30 Q10 22 20 22 Q30 22 30 30" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M24 18 L28 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="30" cy="12" r="2.5" fill="currentColor" />
    </svg>
  );
}

const SERVICE_META: Record<string, { Icon: React.FC; color: string; tagline: string }> = {
  "ground-booking": {
    Icon: GroundIcon,
    color: "text-emerald-700",
    tagline: "Full pitch for your team",
  },
  "net-practice": {
    Icon: NetIcon,
    color: "text-green-700",
    tagline: "Focused batting & bowling",
  },
  "personal-coaching": {
    Icon: CoachIcon,
    color: "text-teal-700",
    tagline: "1-on-1 with the coach",
  },
};

// ─── How It Works ─────────────────────────────────────────────────────────────
const HOW_STEPS = [
  { icon: CalendarDays, title: "Pick a slot", desc: "Choose your service, date, and time" },
  { icon: CreditCard, title: "Pay via UPI", desc: "Scan QR and transfer the amount" },
  { icon: Zap, title: "Upload proof", desc: "Share your payment screenshot" },
  { icon: CheckCircle2, title: "Get confirmed", desc: "Coach reviews and confirms your booking" },
];

// ─── Landing Page ─────────────────────────────────────────────────────────────
export default function Home() {
  const { data: services, isLoading: servicesLoading } = trpc.services.list.useQuery();
  const { data: facility } = trpc.facility.get.useQuery();

  const address = facility?.address ?? "Bengaluru, Karnataka";
  const phone = facility?.coachWhatsApp ?? "";
  const hours = facility?.workingHours ?? "6:00 AM – 9:00 PM";
  const coachName = facility?.coachName ?? "Coach Ravi Kumar";

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20 sm:pb-0">
      {/* ── Top Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2 cursor-pointer">
              <span className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <svg viewBox="0 0 20 20" fill="white" className="w-4 h-4" aria-hidden="true">
                  <path d="M10 2 L12 8 L18 8 L13 12 L15 18 L10 14 L5 18 L7 12 L2 8 L8 8 Z" />
                </svg>
              </span>
              <span className="font-bold text-foreground text-sm" style={{ fontFamily: "Syne, sans-serif" }}>
                BestCricketAcademy
              </span>
            </span>
          </Link>
          <Link href="/booking/status">
            <Button variant="ghost" size="sm" className="text-xs h-8 px-3">
              My Bookings
            </Button>
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, oklch(0.18 0.08 145) 0%, oklch(0.30 0.12 145) 55%, oklch(0.26 0.10 155) 100%)" }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full border border-white/5" />
          <div className="absolute -top-6 -right-6 w-40 h-40 rounded-full border border-white/5" />
          <div className="absolute top-1/2 right-4 w-20 h-20 rounded-full border border-white/5" />
          <div className="absolute bottom-0 left-0 w-36 h-36 rounded-full border border-white/5 -translate-x-1/2 translate-y-1/2" />
          {/* Pitch crease lines */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-28 h-px bg-white/8" />
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-20 h-px bg-white/8" />
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-14 h-px bg-white/8" />
        </div>

        <div className="max-w-lg mx-auto px-4 pt-10 pb-12 relative">
          {/* Coach badge */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full" style={{ background: "oklch(0.78 0.17 85 / 0.18)" }}>
              <Star className="w-3 h-3" style={{ color: "oklch(0.88 0.15 85)" }} fill="oklch(0.88 0.15 85)" />
              <span className="text-xs font-semibold" style={{ color: "oklch(0.92 0.12 85)" }}>
                {coachName}
              </span>
            </div>
          </div>

          <h1
            className="text-[2rem] font-extrabold text-white leading-tight mb-3"
            style={{ fontFamily: "Syne, sans-serif", letterSpacing: "-0.02em" }}
          >
            Book Your Cricket
            <br />
            <span style={{ color: "oklch(0.88 0.15 85)" }}>Session Online</span>
          </h1>
          <p className="text-sm text-white/65 mb-7 leading-relaxed max-w-[280px]">
            Ground booking, net practice, and personal coaching —
            no more WhatsApp back-and-forth.
          </p>
          <div className="flex gap-3">
            <Link href="/book">
              <Button
                size="lg"
                className="h-12 px-6 text-sm font-bold rounded-xl shadow-lg active:scale-[0.97] transition-transform"
                style={{ background: "oklch(0.78 0.17 85)", color: "oklch(0.14 0.01 260)" }}
              >
                Book a Session
              </Button>
            </Link>
            <Link href="/booking/status">
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-5 text-sm font-semibold rounded-xl border-white/20 text-white hover:bg-white/10 bg-transparent active:scale-[0.97] transition-transform"
              >
                Track Booking
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Info Bar ── */}
      <div className="bg-white border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-4 overflow-x-auto text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 shrink-0">
            <Clock className="w-3.5 h-3.5 text-primary" />
            {hours}
          </span>
          {phone && (
            <span className="flex items-center gap-1.5 shrink-0">
              <Phone className="w-3.5 h-3.5 text-primary" />
              {phone}
            </span>
          )}
          <span className="flex items-center gap-1.5 shrink-0">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            {address}
          </span>
        </div>
      </div>

      {/* ── Services ── */}
      <section className="max-w-lg mx-auto px-4 pt-8 pb-2 w-full">
        <div className="mb-5">
          <h2
            className="text-xl font-bold text-foreground"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            Choose a Service
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Select the type of session you want to book
          </p>
        </div>

        {servicesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {services?.map((service) => {
              const meta = SERVICE_META[service.slug] ?? {
                Icon: GroundIcon,
                color: "text-primary",
                tagline: "",
              };
              const priceNum = parseFloat(String(service.price));
              return (
                <Link key={service.id} href={`/book/${service.slug}`}>
                  <div className="group bg-white border border-border rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:border-primary/40 hover:shadow-md active:scale-[0.98] transition-all duration-150">
                    <div className={`w-12 h-12 shrink-0 ${meta.color}`}>
                      <meta.Icon />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground text-[15px] leading-tight">
                            {service.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {meta.tagline}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                      </div>
                      <div className="flex items-center gap-3 mt-2">
                        <span
                          className="text-sm font-bold"
                          style={{ color: "oklch(0.38 0.13 145)" }}
                        >
                          ₹{priceNum.toLocaleString("en-IN")}
                          <span className="text-xs font-normal text-muted-foreground"> / slot</span>
                        </span>
                        {service.durationMinutes && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {service.durationMinutes} min
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ── How It Works ── */}
      <section className="max-w-lg mx-auto px-4 pt-10 pb-2 w-full">
        <h2
          className="text-xl font-bold text-foreground mb-5"
          style={{ fontFamily: "Syne, sans-serif" }}
        >
          How It Works
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {HOW_STEPS.map((step, i) => (
            <div
              key={i}
              className="bg-white border border-border rounded-2xl p-4"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <step.icon className="w-4.5 h-4.5 text-primary" />
              </div>
              <p className="font-semibold text-foreground text-sm leading-tight">{step.title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="max-w-lg mx-auto px-4 pt-8 pb-10 w-full">
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: "linear-gradient(135deg, oklch(0.22 0.08 145), oklch(0.32 0.12 145))" }}
        >
          <p
            className="text-lg font-bold text-white mb-1"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            Ready to play?
          </p>
          <p className="text-sm text-white/70 mb-5">
            Book your session in under 2 minutes.
          </p>
          <Link href="/book">
            <Button
              size="lg"
              className="h-12 px-8 text-sm font-semibold rounded-xl w-full max-w-xs"
              style={{ background: "oklch(0.78 0.17 85)", color: "oklch(0.18 0.01 260)" }}
            >
              Book Now
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Sticky Bottom CTA (mobile only) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white/95 backdrop-blur-md border-t border-border px-4 py-3">
        <Link href="/book">
          <Button
            size="lg"
            className="w-full h-12 rounded-xl text-sm font-bold"
            style={{ background: "oklch(0.38 0.13 145)", color: "white" }}
          >
            Book a Session
          </Button>
        </Link>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-white mt-auto">
        <div className="max-w-lg mx-auto px-4 py-6 text-center">
          <p
            className="font-bold text-foreground text-sm mb-1"
            style={{ fontFamily: "Syne, sans-serif" }}
          >
            BestCricketAcademy
          </p>
          {address && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mb-1">
              <MapPin className="w-3 h-3" /> {address}
            </p>
          )}
          {phone && (
            <a
              href={`https://wa.me/${phone.replace(/\D/g, "")}`}
              className="text-xs text-primary underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp: {phone}
            </a>
          )}
          <p className="text-xs text-muted-foreground mt-3 opacity-60">
            © {new Date().getFullYear()} BestCricketAcademy
          </p>
        </div>
      </footer>
    </div>
  );
}
