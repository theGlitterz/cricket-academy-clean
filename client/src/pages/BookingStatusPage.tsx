/**
 * BookingStatusPage — track a booking by reference ID or WhatsApp number
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useParams } from "wouter";
import { useState } from "react";
import {
  ArrowLeft,
  Search,
  Clock,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Phone,
  User,
  CreditCard,
  ReceiptText,
} from "lucide-react";

// ─── Status Helpers ───────────────────────────────────────────────────────────
function getBookingStatusConfig(status: string) {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        Icon: CheckCircle2,
        bg: "oklch(0.92 0.06 145)",
        color: "oklch(0.32 0.12 145)",
        border: "oklch(0.80 0.08 145)",
      };
    case "pending":
      return {
        label: "Pending Review",
        Icon: Clock,
        bg: "oklch(0.95 0.08 85)",
        color: "oklch(0.50 0.14 85)",
        border: "oklch(0.85 0.10 85)",
      };
    case "rejected":
      return {
        label: "Rejected",
        Icon: XCircle,
        bg: "oklch(0.95 0.04 25)",
        color: "oklch(0.50 0.18 25)",
        border: "oklch(0.85 0.06 25)",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        Icon: XCircle,
        bg: "oklch(0.94 0.01 260)",
        color: "oklch(0.45 0.02 260)",
        border: "oklch(0.82 0.01 260)",
      };
    default:
      return {
        label: status,
        Icon: AlertCircle,
        bg: "oklch(0.94 0.01 260)",
        color: "oklch(0.45 0.02 260)",
        border: "oklch(0.82 0.01 260)",
      };
  }
}

function getPaymentStatusLabel(status: string) {
  switch (status) {
    case "confirmed": return "Payment Confirmed";
    case "pending_review": return "Payment Under Review";
    case "rejected": return "Payment Rejected";
    default: return status;
  }
}

// ─── Booking Result Card ──────────────────────────────────────────────────────
interface BookingRecord {
  id: number;
  referenceId: string;
  playerName: string;
  playerWhatsApp: string;
  bookingDate: string | null;
  startTime: string | null;
  endTime: string | null;
  amount: string;
  bookingStatus: string;
  paymentStatus: string;
  adminNote: string | null;
  createdAt: Date | string;
  serviceName?: string | null;
}

function BookingResultCard({ booking }: { booking: BookingRecord }) {
  const cfg = getBookingStatusConfig(booking.bookingStatus);
  const { Icon } = cfg;
  const priceNum = parseFloat(String(booking.amount));

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
  };

  const formatTime = (t: string | null) => {
    if (!t) return "—";
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  };

  return (
    <div className="bg-white border border-border rounded-2xl overflow-hidden">
      {/* Status Banner */}
      <div
        className="px-4 py-3 flex items-center gap-2.5"
        style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.border}` }}
      >
        <Icon className="w-5 h-5 shrink-0" style={{ color: cfg.color }} />
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: cfg.color }}>{cfg.label}</p>
          <p className="text-xs" style={{ color: `${cfg.color}99` }}>
            {getPaymentStatusLabel(booking.paymentStatus)}
          </p>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full font-mono"
          style={{ background: `${cfg.color}15`, color: cfg.color }}
        >
          {booking.referenceId}
        </span>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Service</p>
            <p className="font-semibold text-foreground text-sm mt-0.5">{booking.serviceName ?? "—"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="font-extrabold text-base mt-0.5" style={{ color: "oklch(0.38 0.13 145)" }}>
              ₹{priceNum.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{formatDate(booking.bookingDate)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-start gap-2">
            <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{booking.playerName}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
              <p className="text-sm font-medium text-foreground mt-0.5">{booking.playerWhatsApp}</p>
            </div>
          </div>
        </div>

        {booking.adminNote && (
          <div className="bg-muted/60 rounded-xl px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Coach note: </span>
              {booking.adminNote}
            </p>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-right">
          Booked on{" "}
          {new Date(booking.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      {/* Contextual message */}
      {booking.bookingStatus === "pending" && (
        <div className="mx-4 mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs text-amber-700">
            <strong>Awaiting confirmation</strong> — The coach is reviewing your payment screenshot.
            You'll receive a WhatsApp message once confirmed.
          </p>
        </div>
      )}
      {booking.bookingStatus === "confirmed" && (
        <div
          className="mx-4 mb-4 rounded-xl p-3"
          style={{ background: "oklch(0.92 0.06 145)", border: "1px solid oklch(0.80 0.08 145)" }}
        >
          <p className="text-xs" style={{ color: "oklch(0.32 0.12 145)" }}>
            <strong>Booking confirmed!</strong> Your slot is reserved. Please arrive 10 minutes early.
          </p>
        </div>
      )}
      {booking.bookingStatus === "rejected" && (
        <div className="mx-4 mb-4 bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs text-red-700">
            <strong>Booking rejected.</strong> Your payment could not be verified. Please contact the coach on WhatsApp for assistance.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookingStatusPage() {
  const params = useParams<{ referenceId?: string }>();

  const [mode, setMode] = useState<"ref" | "whatsapp">("ref");
  const [refInput, setRefInput] = useState(params.referenceId ?? "");
  const [phoneInput, setPhoneInput] = useState("");
  const [searchRef, setSearchRef] = useState(params.referenceId ?? "");
  const [searchPhone, setSearchPhone] = useState("");

  const { data: refBooking, isLoading: refLoading, error: refError } =
    trpc.bookings.getByReference.useQuery(
      { referenceId: searchRef },
      { enabled: !!searchRef }
    );

  const { data: phoneBookings, isLoading: phoneLoading, error: phoneError } =
    trpc.bookings.getByWhatsApp.useQuery(
      { playerWhatsApp: searchPhone },
      { enabled: !!searchPhone }
    );

  const handleRefSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refInput.trim()) return;
    setSearchRef(refInput.trim().toUpperCase());
  };

  const handlePhoneSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length < 10) return;
    const normalised = phoneInput.startsWith("+") ? phoneInput : `+91${digits}`;
    setSearchPhone(normalised);
  };

  const isLoading = mode === "ref" ? refLoading : phoneLoading;
  const hasError = mode === "ref" ? !!refError : !!phoneError;
  const hasSearched = mode === "ref" ? !!searchRef : !!searchPhone;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/">
            <button
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
              aria-label="Back to home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <p className="flex-1 text-sm font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
            Track Booking
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-10">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-foreground leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
            Check Your Booking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Find your booking by reference ID or WhatsApp number
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-5">
          {(["ref", "whatsapp"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
              style={{
                background: mode === m ? "white" : "transparent",
                color: mode === m ? "oklch(0.38 0.13 145)" : "oklch(0.52 0.02 260)",
                boxShadow: mode === m ? "0 1px 3px rgba(0,0,0,0.1)" : undefined,
              }}
            >
              {m === "ref" ? <ReceiptText className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
              {m === "ref" ? "Reference ID" : "WhatsApp"}
            </button>
          ))}
        </div>

        {/* Search Form */}
        {mode === "ref" ? (
          <form onSubmit={handleRefSearch} className="flex gap-2 mb-6">
            <Input
              placeholder="e.g. BCA-20240409-XXXX"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value.toUpperCase())}
              className="h-12 rounded-xl text-base flex-1 font-mono"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 px-4 rounded-xl shrink-0"
              style={{ background: "oklch(0.38 0.13 145)", color: "white" }}
            >
              <Search className="w-4 h-4" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handlePhoneSearch} className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">+91</span>
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="9876543210"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/[^\d+\s\-()]/g, ""))}
                className="h-12 rounded-xl text-base pl-11"
                autoComplete="tel"
                maxLength={15}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="h-12 px-4 rounded-xl shrink-0"
              style={{ background: "oklch(0.38 0.13 145)", color: "white" }}
            >
              <Search className="w-4 h-4" />
            </Button>
          </form>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
            <p className="text-sm">Looking up your booking…</p>
          </div>
        )}

        {/* Error / Not Found */}
        {!isLoading && hasError && (
          <div className="text-center py-12 bg-muted/40 rounded-2xl">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm font-medium text-foreground">Booking not found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Double-check your {mode === "ref" ? "reference ID" : "WhatsApp number"} and try again
            </p>
          </div>
        )}

        {/* Results — Reference */}
        {!isLoading && !hasError && mode === "ref" && refBooking && (
          <BookingResultCard booking={refBooking as BookingRecord} />
        )}

        {/* Results — WhatsApp */}
        {!isLoading && !hasError && mode === "whatsapp" && phoneBookings && (
          phoneBookings.length === 0 ? (
            <div className="text-center py-12 bg-muted/40 rounded-2xl">
              <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
              <p className="text-sm font-medium text-foreground">No bookings found</p>
              <p className="text-xs text-muted-foreground mt-1">
                No bookings are linked to this WhatsApp number
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {phoneBookings.length} booking{phoneBookings.length !== 1 ? "s" : ""} found
              </p>
              {(phoneBookings as BookingRecord[]).map((b) => (
                <BookingResultCard key={b.id} booking={b} />
              ))}
            </div>
          )
        )}

        {/* Empty state */}
        {!isLoading && !hasError && !hasSearched && (
          <div className="text-center py-12">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "oklch(0.38 0.13 145 / 0.08)" }}
            >
              <CreditCard className="w-7 h-7" style={{ color: "oklch(0.38 0.13 145)" }} />
            </div>
            <p className="text-sm font-medium text-foreground">Enter your booking details above</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Use the reference ID from your confirmation, or search by your WhatsApp number
            </p>
          </div>
        )}

        {/* Book another CTA */}
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground mb-3">Want to book another session?</p>
          <Link href="/book">
            <Button
              size="lg"
              className="h-12 px-8 rounded-xl font-semibold"
              style={{ background: "oklch(0.38 0.13 145)", color: "white" }}
            >
              Book a Session
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
