/**
 * BookingPage — 5-step player booking flow
 * Steps: service → slot → details → payment → done
 * Mobile-first, optimised for WhatsApp link sharing.
 */
import { trpc } from "@/lib/trpc";
import { buildWhatsAppLink, buildPlayerToCoachMessage } from "@/lib/utils/booking";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Link, useLocation, useParams } from "wouter";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Clock,
  CalendarDays,
  CheckCircle2,
  Upload,
  Copy,
  Loader2,
  ChevronRight,
  AlertCircle,
  ImageIcon,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Step = "service" | "slot" | "details" | "payment" | "done";

interface BookingState {
  serviceId?: number;
  serviceSlug?: string;
  serviceName?: string;
  servicePrice?: string;
  serviceAdvance?: string;
  serviceDuration?: number;
  slotId?: number;
  slotDate?: string;
  slotStart?: string;
  slotEnd?: string;
  playerName?: string;
  playerWhatsApp?: string;
  bookingId?: number;
  referenceId?: string;
}


const STEP_ORDER: Step[] = ["service", "slot", "details", "payment", "done"];

// ─── Step Progress Bar ────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const steps: Step[] = ["service", "slot", "details", "payment"];
  const labels = ["Service", "Date & Slot", "Details", "Payment"];
  const idx = steps.indexOf(current);
  if (current === "done") return null;
  return (
    <div className="px-4 pt-2.5 pb-2">
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-muted">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: i < idx ? "100%" : i === idx ? "60%" : "0%",
                background: "oklch(0.38 0.13 145)",
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        {labels.map((label, i) => (
          <span
            key={label}
            className="text-[10px] font-medium"
            style={{ color: i <= idx ? "oklch(0.38 0.13 145)" : "oklch(0.60 0.02 260)" }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Service Selection ────────────────────────────────────────────────
function ServiceStep({
  initialSlug,
  onSelect,
}: {
  initialSlug?: string;
    onSelect: (s: { id: number; slug: string; name: string; price: string; advance: string; duration: number }) => void;
}) {
  const { data: services, isLoading } = trpc.services.list.useQuery();
  const [selected, setSelected] = useState<number | null>(null);

  const colorMap: Record<string, string> = {
    "ground-booking": "oklch(0.38 0.13 145)",
    "net-practice": "oklch(0.42 0.14 155)",
    "personal-coaching": "oklch(0.35 0.12 175)",
  };

  const iconMap: Record<string, React.ReactNode> = {
    "ground-booking": (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <ellipse cx="12" cy="17" rx="8" ry="3" />
        <path d="M7 14 Q12 5 17 14" />
        <circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
    "net-practice": (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="6" width="16" height="12" rx="1" />
        <line x1="4" y1="10" x2="20" y2="10" /><line x1="4" y1="14" x2="20" y2="14" />
        <line x1="9" y1="6" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="18" />
        <circle cx="19" cy="12" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    ),
    "personal-coaching": (
      <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M5 20 Q5 14 12 14 Q19 14 19 20" />
        <path d="M16 10 L19 7" />
        <circle cx="20" cy="6" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
          What would you like to book?
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Choose a service to get started</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      ) : !services?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No services available right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => {
            const isSelected = selected === service.id;
            const color = colorMap[service.slug] ?? "oklch(0.38 0.13 145)";
            const priceNum = parseFloat(String(service.price));
            return (
              <button
                key={service.id}
                onClick={() => {
                    setTimeout(() => onSelect({
                    id: service.id,
                    slug: service.slug,
                    name: service.name,
                    price: String(service.price),
                    advance: String(service.advanceAmount ?? "0"),
                    duration: service.durationMinutes,
                  }), 120);

                }}
                className="w-full text-left"
              >
                <div
                  className="rounded-2xl border-2 p-4 flex items-center gap-4 transition-all duration-150 active:scale-[0.98]"
                  style={{
                    borderColor: isSelected ? color : "oklch(0.88 0.01 260)",
                    background: isSelected ? `${color}12` : "white",
                    boxShadow: isSelected ? `0 0 0 3px ${color}20` : undefined,
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${color}15`, color }}
                  >
                    {iconMap[service.slug] ?? iconMap["ground-booking"]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground text-[15px]">{service.name}</p>
                      {isSelected
                        ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color }} />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      }
                    </div>
                    {service.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{service.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-bold" style={{ color }}>
                        ₹{priceNum.toLocaleString("en-IN")}
                        <span className="text-xs font-normal text-muted-foreground"> / slot</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {service.durationMinutes} min
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step 2: Date & Slot Selection ────────────────────────────────────────────
function SlotStep({
  serviceId,
  serviceName,
  onSelect,
}: {
  serviceId: number;
  serviceName: string;
  onSelect: (slot: { id: number; date: string; start: string; end: string }) => void;
}) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toISOString().slice(0, 10));

  const { data: slots, isLoading } = trpc.slots.getAvailable.useQuery({ serviceId, date: selectedDate });

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return {
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.getDate(),
      month: d.toLocaleDateString("en-IN", { month: "short" }),
      isToday: dateStr === today.toISOString().slice(0, 10),
    };
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-foreground leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
          Pick a Date & Slot
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{serviceName} — select your preferred time</p>
      </div>

      {/* Date Scroller */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Select Date</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
          {dates.map((date) => {
            const { day, date: d, month, isToday } = formatDate(date);
            const isSelected = date === selectedDate;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className="shrink-0 w-[3.5rem] rounded-2xl py-2.5 flex flex-col items-center gap-0.5 border-2 transition-all duration-150 active:scale-95"
                style={{
                  borderColor: isSelected ? "oklch(0.38 0.13 145)" : "oklch(0.88 0.01 260)",
                  background: isSelected ? "oklch(0.38 0.13 145)" : "white",
                  color: isSelected ? "white" : "oklch(0.18 0.01 260)",
                }}
              >
                <span className="text-[10px] font-medium opacity-70">{day}</span>
                <span className="text-base font-extrabold leading-none">{d}</span>
                <span className="text-[10px] opacity-70">{month}</span>
                {isToday && (
                  <span
                    className="text-[9px] font-bold mt-0.5 px-1 rounded-full"
                    style={{
                      background: isSelected ? "rgba(255,255,255,0.25)" : "oklch(0.38 0.13 145 / 0.15)",
                      color: isSelected ? "white" : "oklch(0.38 0.13 145)",
                    }}
                  >
                    Today
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Slot Grid */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Available Slots —{" "}
          {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
            weekday: "long", day: "numeric", month: "long",
          })}
        </p>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : slots && slots.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5">
            {slots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => onSelect({ id: slot.id, date: selectedDate, start: slot.startTime, end: slot.endTime })}
                className="bg-white border-2 border-border rounded-2xl p-3.5 text-left hover:border-primary/50 hover:bg-primary/5 active:scale-[0.96] transition-all duration-150 group"
              >
                <p className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                  {formatTime(slot.startTime)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">to {formatTime(slot.endTime)}</p>
                <div className="mt-2 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-emerald-700 font-medium">Available</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/40 rounded-2xl">
            <CalendarDays className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm font-medium text-foreground">No slots on this date</p>
            <p className="text-xs text-muted-foreground mt-1">Try selecting a different date above</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Player Details ───────────────────────────────────────────────────
function DetailsStep({
  booking,
  onSubmit,
}: {
  booking: BookingState;
  onSubmit: (name: string, whatsApp: string) => void;
}) {

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const validate = () => {
    const e: { name?: string; phone?: string } = {};
    if (!name.trim()) e.name = "Please enter your full name";
    if (!phone.trim()) e.phone = "WhatsApp number is required";
    else if (phone.replace(/\D/g, "").length < 10) e.phone = "Enter a valid 10-digit number";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const digits = phone.replace(/\D/g, "");
    const normalised = phone.trim().startsWith("+") ? phone.trim() : `+91${digits}`;
    onSubmit(name.trim(), normalised);
  };

  const priceNum = parseFloat(booking.servicePrice ?? "0");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-foreground leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
          Your Details
        </h1>
        <p className="text-sm text-muted-foreground mt-1">We'll use these to confirm your booking</p>
      </div>

      {/* Summary Card */}
      <div className="rounded-2xl p-4 mb-6 border" style={{ background: "oklch(0.95 0.03 145)", borderColor: "oklch(0.85 0.06 145)" }}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Booking Summary</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Service</span>
            <span className="font-semibold text-foreground">{booking.serviceName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Date</span>
            <span className="font-semibold text-foreground">
              {booking.slotDate ? new Date(booking.slotDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Time</span>
            <span className="font-semibold text-foreground">{booking.slotStart} – {booking.slotEnd}</span>
          </div>
                  <div className="border-t border-border/50 pt-1.5 mt-1.5 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Price</span>
              <span className="font-semibold text-foreground">₹{priceNum.toLocaleString("en-IN")}</span>
            </div>
            {(() => {
              const advance = parseFloat(booking.serviceAdvance ?? "0");
              const remaining = priceNum - advance;
              if (advance > 0) return (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pay Now</span>
                    <span className="font-extrabold" style={{ color: "oklch(0.38 0.13 145)" }}>₹{advance.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pay at Ground</span>
                    <span className="font-semibold text-foreground">₹{remaining.toLocaleString("en-IN")}</span>
                  </div>
                </>
              );
              return (
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-foreground">Pay Now</span>
                  <span className="font-extrabold" style={{ color: "oklch(0.38 0.13 145)" }}>₹{priceNum.toLocaleString("en-IN")}</span>
                </div>
              );
            })()}
          </div>

        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-sm font-semibold text-foreground mb-1.5 block">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            placeholder="e.g. Rahul Sharma"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
            className={`h-12 rounded-xl text-base ${errors.name ? "border-destructive" : ""}`}
            autoComplete="name"
          />
          {errors.name && (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.name}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="phone" className="text-sm font-semibold text-foreground mb-1.5 block">
            WhatsApp Number <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium select-none">+91</span>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              placeholder="9876543210"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/[^\d+\s\-()]/g, ""));
                setErrors((p) => ({ ...p, phone: undefined }));
              }}
              className={`h-12 rounded-xl text-base pl-11 ${errors.phone ? "border-destructive" : ""}`}
              autoComplete="tel"
              maxLength={15}
            />
          </div>
          {errors.phone ? (
            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errors.phone}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Booking confirmation will be sent to this number</p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full h-12 rounded-xl text-base font-semibold mt-2"
          style={{ background: "oklch(0.38 0.13 145)", color: "white" }}
        >
          Continue to Payment →
        </Button>

      </form>
    </div>
  );
}

// ─── Step 4: Payment ──────────────────────────────────────────────────────────
function PaymentStep({
  booking,
  onPaymentUploaded,
}: {
  booking: BookingState;
  onPaymentUploaded: (bookingId: number, referenceId: string) => void;
}) {
  const { data: facility } = trpc.facility.get.useQuery();

  const createBookingMutation = trpc.bookings.create.useMutation({
    onError: (err) => toast.error(err.message ?? "Failed to create booking. Please try again."),
  });

  const uploadMutation = trpc.bookings.uploadPayment.useMutation({
    onSuccess: () => { toast.success("Payment screenshot uploaded!"); },
    onError: (err) => toast.error(err.message),
  });


  const [preview, setPreview] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return; }
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setPreview(result);
      setFileBase64(result.split(",")[1] ?? null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!fileBase64) { toast.error("Please upload your payment screenshot first"); return; }
    if (!booking.slotId || !booking.serviceId || !booking.playerName || !booking.playerWhatsApp) {
      toast.error("Booking details missing. Please go back and try again.");
      return;
    }
    try {
      const result = await createBookingMutation.mutateAsync({
        slotId: booking.slotId,
        serviceId: booking.serviceId,
        playerName: booking.playerName,
        playerWhatsApp: booking.playerWhatsApp,
      });
      await uploadMutation.mutateAsync({
        bookingId: result.id,
        fileBase64,
        mimeType,
      });
      onPaymentUploaded(result.id, result.referenceId);
    } catch {
      // errors already shown via onError handlers above
    }
  };


  const totalPrice = parseFloat(booking.servicePrice ?? "0");
  const advanceAmount = parseFloat(booking.serviceAdvance ?? "0");
  const remainingAmount = totalPrice - advanceAmount;
  const payNow = advanceAmount > 0 ? advanceAmount : totalPrice;
  const hasAdvance = advanceAmount > 0 && advanceAmount < totalPrice;

  const upiId = facility?.upiId ?? "bestcricket@upi";
  const qrUrl = facility?.upiQrImageUrl;

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId).then(() => toast.success("UPI ID copied!"));
  };

  const copyAmount = () => {
    navigator.clipboard.writeText(String(payNow)).then(() => toast.success("Amount copied!"));
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-foreground leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
          Complete Payment
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Pay via UPI and upload your screenshot</p>
      </div>

      {/* Amount Banner */}
      <div
        className="rounded-2xl p-4 mb-5"
        style={{ background: "linear-gradient(135deg, oklch(0.22 0.08 145), oklch(0.32 0.12 145))" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-white/70 font-medium">{hasAdvance ? "Advance to Pay Now" : "Amount to Pay"}</p>
            <p className="text-3xl font-extrabold text-white mt-0.5" style={{ fontFamily: "Syne, sans-serif" }}>
              ₹{payNow.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-white/60 mt-0.5">{booking.serviceName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/70">
              {booking.slotDate && new Date(booking.slotDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </p>
            <p className="text-sm font-semibold text-white mt-0.5">{booking.slotStart} – {booking.slotEnd}</p>
          </div>
        </div>

        {hasAdvance && (
          <div className="border-t border-white/20 pt-3 space-y-1.5">
            <div className="flex justify-between text-xs text-white/80">
              <span>Total price</span>
              <span className="font-semibold">₹{totalPrice.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-xs text-white/80">
              <span>Pay now (advance)</span>
              <span className="font-semibold text-white">₹{advanceAmount.toLocaleString("en-IN")}</span>
            </div>
            <div className="flex justify-between text-xs text-white/80">
              <span>Pay at ground</span>
              <span className="font-semibold">₹{remainingAmount.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}
      </div>

      {/* UPI Section */}
      <div className="bg-white border border-border rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pay via UPI</p>

        {qrUrl ? (
          <div className="flex justify-center mb-4">
            <div className="p-3 border-2 border-border rounded-2xl bg-white">
              <img src={qrUrl} alt="UPI QR Code" className="w-44 h-44 object-contain" />
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            <div className="w-44 h-44 border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-muted/30">
              <ImageIcon className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs text-center px-4">QR code not configured yet</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-3 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">UPI ID</p>
            <p className="text-sm font-bold text-foreground mt-0.5 truncate">{upiId}</p>
          </div>
          <button
            onClick={copyUpi}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors shrink-0"
            style={{ color: "oklch(0.38 0.13 145)" }}
          >
            <Copy className="w-3.5 h-3.5" /> Copy UPI
          </button>
        </div>

        <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Amount</p>
            <p className="text-sm font-bold text-foreground mt-0.5">₹{payNow.toLocaleString("en-IN")}</p>
          </div>
          <button
            onClick={copyAmount}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors shrink-0"
            style={{ color: "oklch(0.38 0.13 145)" }}
          >
            <Copy className="w-3.5 h-3.5" /> Copy Amount
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-3 text-center">Scan QR or copy UPI ID to pay</p>
      </div>

      {/* Screenshot Upload */}
      <div className="bg-white border border-border rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Upload Payment Screenshot <span className="text-destructive">*</span>
        </p>

        {preview ? (
          <div className="relative">
            <img src={preview} alt="Payment screenshot" className="w-full rounded-xl object-contain max-h-64 border border-border" />
            <button
              onClick={() => { setPreview(null); setFileBase64(null); if (fileRef.current) fileRef.current.value = ""; }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="mt-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">Screenshot ready to submit</span>
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-border rounded-xl py-8 flex flex-col items-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all active:scale-[0.98]"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Tap to upload screenshot</p>
              <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG — max 5 MB</p>
            </div>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      </div>

      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
        <p className="text-xs font-semibold text-amber-800 mb-1.5">Important Instructions</p>
        <ul className="text-xs text-amber-700 space-y-1">
          {hasAdvance ? (
            <>
              <li>• Pay the advance amount of ₹{advanceAmount.toLocaleString("en-IN")} now via UPI</li>
              <li>• Remaining ₹{remainingAmount.toLocaleString("en-IN")} is payable at the ground</li>
            </>
          ) : (
            <li>• Pay the exact amount of ₹{payNow.toLocaleString("en-IN")} shown above</li>
          )}
          <li>• Take a screenshot of the payment confirmation</li>
          <li>• Upload the screenshot using the button above</li>
          <li>• Your booking is confirmed automatically after screenshot upload</li>
        </ul>
      </div>

      <Button
        size="lg"
        onClick={handleSubmit}
        disabled={!fileBase64 || createBookingMutation.isPending || uploadMutation.isPending}
        className="w-full h-12 rounded-xl text-base font-semibold"
        style={{ background: "oklch(0.38 0.13 145)", color: "white" }}
      >
        {(createBookingMutation.isPending || uploadMutation.isPending) ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
        ) : "Submit Booking Request"}
      </Button>


      {!fileBase64 && (
        <p className="text-xs text-center text-muted-foreground mt-2">Upload your payment screenshot to continue</p>
      )}
    </div>
  );
}


// ─── Step 5: Done ─────────────────────────────────────────────────────────────
function DoneStep({ booking, facility }: { booking: BookingState; facility?: { coachWhatsApp?: string | null; facilityName?: string | null } | null }) {
  const shareText = `I've booked a ${booking.serviceName} session at BestCricketAcademy on ${booking.slotDate} at ${booking.slotStart}. Reference: ${booking.referenceId}`;
  const priceNum = parseFloat(booking.servicePrice ?? "0");
  const advanceNum = parseFloat(booking.serviceAdvance ?? "0");
  const remainingNum = priceNum - advanceNum;
  const coachWaLink = facility?.coachWhatsApp
    ? buildWhatsAppLink(
        facility.coachWhatsApp,
        buildPlayerToCoachMessage({
          playerName: booking.playerName ?? "",
          serviceName: booking.serviceName ?? "",
          bookingDate: booking.slotDate ?? "",
          startTime: booking.slotStart ?? "",
          endTime: booking.slotEnd ?? "",
          referenceId: booking.referenceId ?? "",
          totalPrice: priceNum,
          advancePaid: advanceNum,
          remainingAtGround: remainingNum,
          facilityName: facility?.facilityName ?? undefined,
        })
      )
    : null;


  return (
    <div className="text-center py-4">
      <div className="flex justify-center mb-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "oklch(0.38 0.13 145 / 0.12)" }}>
          <CheckCircle2 className="w-10 h-10" style={{ color: "oklch(0.38 0.13 145)" }} />
        </div>
      </div>

      <h1 className="text-2xl font-extrabold text-foreground mb-2" style={{ fontFamily: "Syne, sans-serif" }}>
        Booking Confirmed!
      </h1>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto">
        Your payment has been received and your slot is confirmed.
      </p>

      {/* Reference Card */}
      <div className="bg-white border border-border rounded-2xl p-5 text-left mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Booking Reference</p>
            <Badge className="text-xs font-semibold px-2.5 py-1 rounded-full border-0" style={{ background: "oklch(0.38 0.13 145 / 0.15)", color: "oklch(0.38 0.13 145)" }}>
            Confirmed
          </Badge>

        </div>
        <p className="text-2xl font-extrabold mb-4 tracking-wider" style={{ fontFamily: "Syne, sans-serif", color: "oklch(0.38 0.13 145)" }}>
          {booking.referenceId}
        </p>
        <div className="space-y-2 border-t border-border pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Service</span>
            <span className="font-medium text-foreground">{booking.serviceName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Date</span>
            <span className="font-medium text-foreground">
              {booking.slotDate ? new Date(booking.slotDate + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long" }) : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Time</span>
            <span className="font-medium text-foreground">{booking.slotStart} – {booking.slotEnd}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium text-foreground">{booking.playerName}</span>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="rounded-2xl p-4 text-left mb-6 border" style={{ background: "oklch(0.95 0.03 145)", borderColor: "oklch(0.85 0.06 145)" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: "oklch(0.38 0.13 145)" }}>What happens next?</p>
        <ul className="text-xs text-muted-foreground space-y-1.5">
          {["Your slot is locked — no one else can book it", "Show your booking reference & make remaining payment at the ground", "Arrive 10 minutes before your session"].map((text, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[9px] font-bold text-primary">{i + 1}</span>
              {text}
            </li>
          ))}
        </ul>
      </div>

           <div className="flex flex-col gap-3">
        <Link href={`/booking/${booking.referenceId}`}>
          <Button size="lg" className="w-full h-12 rounded-xl font-semibold" style={{ background: "oklch(0.38 0.13 145)", color: "white" }}>
            Track Booking Status
          </Button>
        </Link>
        {coachWaLink && (
          <a href={coachWaLink} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="w-full h-12 rounded-xl font-semibold" style={{ background: "oklch(0.25 0.12 145)", color: "white" }}>
              Send details to coach on WhatsApp
            </Button>
          </a>
        )}
        <a href={`https://wa.me/?text=${encodeURIComponent(shareText )}`} target="_blank" rel="noopener noreferrer">
          <Button size="lg" variant="outline" className="w-full h-12 rounded-xl font-semibold border-2">
            Share on WhatsApp
          </Button>
        </a>

        <Link href="/">
          <Button variant="ghost" size="lg" className="w-full h-12 rounded-xl text-muted-foreground">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Main BookingPage ─────────────────────────────────────────────────────────
export default function BookingPage() {
  const params = useParams<{ serviceSlug?: string }>();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>(params.serviceSlug ? "slot" : "service");
  const [booking, setBooking] = useState<BookingState>({ serviceSlug: params.serviceSlug });

  const { data: services } = trpc.services.list.useQuery();

  // Pre-load service from URL slug
  useEffect(() => {
    if (params.serviceSlug && services && !booking.serviceId) {
      const svc = services.find((s) => s.slug === params.serviceSlug);
      if (svc) {
        setBooking({
          serviceId: svc.id,
          serviceSlug: svc.slug,
          serviceName: svc.name,
          servicePrice: String(svc.price),
          serviceAdvance: String(svc.advanceAmount ?? "0"),
          serviceDuration: svc.durationMinutes,
        });
      }
    }
  }, [params.serviceSlug, services, booking.serviceId]);


  const goBack = useCallback(() => {
    if (step === "done") return;
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
    else navigate("/");
  }, [step, navigate]);

  const headerTitle: Record<Step, string> = {
    service: "Book a Session",
    slot: "Pick a Slot",
    details: "Your Details",
    payment: "Payment",
    done: "Booking Confirmed",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-border">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          {step !== "done" ? (
            <button
              onClick={goBack}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : <div className="w-9" />}
          <p className="flex-1 text-sm font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
            {headerTitle[step]}
          </p>
          <Link href="/">
            <span className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">BCA</span>
          </Link>
        </div>
        <StepBar current={step} />
      </header>

      {/* Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-10">
        {step === "service" && (
          <ServiceStep
            initialSlug={booking.serviceSlug}
            onSelect={(service) => {
             setBooking({ serviceId: service.id, serviceSlug: service.slug, serviceName: service.name, servicePrice: service.price, serviceAdvance: service.advance, serviceDuration: service.duration });
             setStep("slot");
            }}

          />
        )}

        {step === "slot" && booking.serviceId && (
          <SlotStep
            serviceId={booking.serviceId}
            serviceName={booking.serviceName ?? ""}
            onSelect={(slot) => {
              setBooking((prev) => ({ ...prev, slotId: slot.id, slotDate: slot.date, slotStart: slot.start, slotEnd: slot.end }));
              setStep("details");
            }}
          />
        )}

              {step === "details" && (
          <DetailsStep
            booking={booking}
            onSubmit={(name, whatsApp) => {
              setBooking((prev) => ({ ...prev, playerName: name, playerWhatsApp: whatsApp }));
              setStep("payment");
            }}
          />
        )}


          {step === "payment" && (
          <PaymentStep
            booking={booking}
            onPaymentUploaded={(bookingId, referenceId) => {
              setBooking((prev) => ({ ...prev, bookingId, referenceId }));
              setStep("done");
            }}
          />
        )}


        {step === "done" && <DoneStep booking={booking} facility={facility} />}
      </main>
    </div>
  );
}
