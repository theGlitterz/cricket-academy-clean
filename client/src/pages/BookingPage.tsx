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
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Clock,
  CalendarDays,
  CheckCircle2,
  Loader2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

// Razorpay Checkout is loaded via <script> in index.html
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open(): void };
  }
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Converts "HH:MM" 24-hour string to "H:MM AM/PM" for display only. */
function formatTime(t: string): string {
  if (!t) return t;
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

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
  slotPrice?: string;   // slot-level total price (overrides servicePrice)
  slotAdvance?: string; // slot-level advance (overrides serviceAdvance)
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
                        {(service as { minSlotPrice?: number | null }).minSlotPrice != null ? (
                          <>
                            <span className="text-xs font-normal text-muted-foreground">From </span>
                            ₹{Number((service as { minSlotPrice?: number | null }).minSlotPrice).toLocaleString("en-IN")}
                          </>
                        ) : (
                          <>₹{priceNum.toLocaleString("en-IN")}</>
                        )}
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
  onSelect: (slot: { id: number; date: string; start: string; end: string; slotPrice?: number | null; slotAdvance?: number | null }) => void;
}) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  // Fetch all dates that have at least one slot in the next 90 days.
  const { data: datesWithSlots } = trpc.slots.getDatesWithSlots.useQuery({ serviceId });
  // Build the date list: unique sorted dates from the server, always include today.
  const dates = useMemo(() => {
    const set = new Set<string>(datesWithSlots ?? []);
    set.add(todayStr);
    return Array.from(set).sort();
  }, [datesWithSlots, todayStr]);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  // When the date list loads, auto-select the first date that has slots.
  useEffect(() => {
    if (datesWithSlots && datesWithSlots.length > 0 && !datesWithSlots.includes(selectedDate)) {
      setSelectedDate(datesWithSlots[0]);
    }
  }, [datesWithSlots]);
  const { data: slots, isLoading } = trpc.slots.getAvailable.useQuery({ serviceId, date: selectedDate });


  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return {
      day: d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.getDate(),
      month: d.toLocaleDateString("en-IN", { month: "short" }),
      isToday: dateStr === today.toISOString().slice(0, 10),
    };
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
          Slots —{" "}
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
                        {slots.map((slot) => {
              const isBooked = slot.availabilityStatus === "booked";
              return (
                <button
                  key={slot.id}
                  disabled={isBooked}
                  onClick={() => !isBooked && onSelect({
                    id: slot.id,
                    date: selectedDate,
                    start: slot.startTime,
                    end: slot.endTime,
                    slotPrice: (slot as { price?: number | null }).price,
                    slotAdvance: (slot as { advanceAmount?: number | null }).advanceAmount,
                  })}
                  className={[
                    "border-2 rounded-2xl p-3.5 text-left transition-all duration-150",
                    isBooked
                      ? "bg-red-50 border-red-200 cursor-not-allowed opacity-80"
                      : "bg-white border-border hover:border-primary/50 hover:bg-primary/5 active:scale-[0.96] group cursor-pointer",
                  ].join(" ")}
                >
                  <p className={["font-bold text-sm", isBooked ? "text-red-400" : "text-foreground group-hover:text-primary transition-colors"].join(" ")}>
                    {formatTime(slot.startTime)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">to {formatTime(slot.endTime)}</p>
                    <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {isBooked ? (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          <span className="text-[11px] text-red-500 font-medium">Booked</span>
                        </>
                      ) : (
                        <>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[11px] text-emerald-700 font-medium">Available</span>
                        </>
                      )}
                    </div>
                    {!isBooked && (slot as { price?: number | null }).price != null && (
                      <span className="text-[11px] font-bold text-foreground">
                        ₹{((slot as { price?: number | null }).price!).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>

                </button>
              );
            })}

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

  const priceNum = parseFloat(booking.slotPrice ?? booking.servicePrice ?? "0");

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
            <span className="font-semibold text-foreground">{formatTime(booking.slotStart ?? "")} – {formatTime(booking.slotEnd ?? "")}</span>
          </div>
                  <div className="border-t border-border/50 pt-1.5 mt-1.5 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Price</span>
              <span className="font-semibold text-foreground">₹{priceNum.toLocaleString("en-IN")}</span>
            </div>
            {(() => {
              const advance = parseFloat(booking.slotAdvance ?? booking.serviceAdvance ?? "0");
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
  facility,
  onPaymentUploaded,
}: {
  booking: BookingState;
  facility?: { coachWhatsApp?: string | null; facilityName?: string | null } | null;
  onPaymentUploaded: (bookingId: number, referenceId: string) => void;
}) {
  const [rzpLoading, setRzpLoading] = useState(false);

  const createOrderMutation = trpc.payments.createOrder.useMutation({
    onError: (err) => {
      toast.error(err.message ?? "Failed to create payment order. Please try again.");
      setRzpLoading(false);
    },
  });

  const verifyMutation = trpc.payments.verifyAndConfirmBooking.useMutation({
    onError: (err) => {
      toast.error(err.message ?? "Payment verification failed. Please contact support.");
      setRzpLoading(false);
    },
  });

  const totalPrice = parseFloat(booking.slotPrice ?? booking.servicePrice ?? "0");
  const advanceAmount = parseFloat(booking.slotAdvance ?? booking.serviceAdvance ?? "0");
  const remainingAmount = Math.max(0, totalPrice - advanceAmount);


  const handlePayAdvance = async () => {
    if (!booking.serviceId || !booking.slotId) {
      toast.error("Service or slot information is missing. Please restart.");
      return;
    }
    if (!window.Razorpay) {
      toast.error("Payment SDK not loaded. Please refresh the page and try again.");
      return;
    }

    setRzpLoading(true);
    try {
      const order = await createOrderMutation.mutateAsync({
        serviceId: booking.serviceId,
        slotId: booking.slotId,
      });

      const options: Record<string, unknown> = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID as string,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "BestCricketAcademy",
        description: booking.serviceName ?? "Cricket Session Advance",
        prefill: {
          name: booking.playerName ?? "",
          contact: booking.playerWhatsApp ?? "",
        },
        theme: { color: "#1a4d2e" },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const result = await verifyMutation.mutateAsync({
              slotId: booking.slotId!,
              serviceId: booking.serviceId!,
              playerName: booking.playerName ?? "",
              playerWhatsApp: booking.playerWhatsApp ?? "",
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment verified! Booking confirmed.");
            onPaymentUploaded(result.bookingId, result.referenceId);
          } catch {
            // error already shown by verifyMutation.onError above
          }
        },
        modal: {
          ondismiss: () => {
            setRzpLoading(false);
            toast("Payment cancelled. You can try again.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch {
      setRzpLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-foreground leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
          Complete Payment
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Pay the advance to confirm your slot instantly</p>
      </div>

      {/* Amount Banner */}
      <div
        className="rounded-2xl p-4 mb-5"
        style={{ background: "linear-gradient(135deg, oklch(0.22 0.08 145), oklch(0.32 0.12 145))" }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-white/70 font-medium">Advance to Pay Now</p>
            <p className="text-3xl font-extrabold text-white mt-0.5" style={{ fontFamily: "Syne, sans-serif" }}>
              ₹{advanceAmount.toLocaleString("en-IN")}
            </p>
            <p className="text-xs text-white/60 mt-0.5">{booking.serviceName}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/60">
              {booking.slotDate && new Date(booking.slotDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </p>
            <p className="text-sm font-semibold text-white mt-0.5">{formatTime(booking.slotStart ?? "")} – {formatTime(booking.slotEnd ?? "")}</p>
          </div>
        </div>
        <div className="border-t border-white/20 pt-3 flex gap-6">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">Total Price</p>
            <p className="text-sm font-semibold text-white/90">₹{totalPrice.toLocaleString("en-IN")}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wider">Remaining at Ground</p>
            <p className="text-sm font-semibold text-white/90">₹{remainingAmount.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <Button
        size="lg"
        onClick={handlePayAdvance}
        disabled={rzpLoading || createOrderMutation.isPending || verifyMutation.isPending}
        className="w-full h-12 rounded-xl text-base font-semibold mb-4"
        style={{ background: "oklch(0.38 0.13 145)", color: "white" }}
      >
        {verifyMutation.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirming Booking…</>
        ) : rzpLoading || createOrderMutation.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Opening Payment…</>
        ) : "Pay Advance"}
      </Button>

      {/* Instructions */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-3">
        <p className="text-xs font-semibold text-amber-800 mb-1.5">Important</p>
        <ul className="text-xs text-amber-700 space-y-1">
          <li>• Pay the advance to lock your slot</li>
          <li>• Your booking is confirmed instantly after successful payment</li>
          <li>• Pay the remaining ₹{remainingAmount.toLocaleString("en-IN")} at the ground</li>
        </ul>
      </div>

      {/* Rain Policy */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
        <p className="text-xs font-semibold text-blue-800 mb-1.5">Rain Policy</p>
        <p className="text-xs text-blue-700 leading-relaxed">
          If rain starts before the first innings is complete, half ground rent is payable. If rain starts after one innings is complete, full ground rent is payable. If rain starts before the match start time, the booking can be rescheduled subject to ground availability.
        </p>
        <p className="text-[11px] text-blue-500 mt-1.5">*Rain policy applies to ground bookings only.</p>
      </div>

          </div>
  );
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────
function DoneStep({ booking, facility }: { booking: BookingState; facility?: { coachWhatsApp?: string | null; facilityName?: string | null } | null }) {
  const shareText = `I've booked a ${booking.serviceName} session at BestCricketAcademy on ${booking.slotDate} at ${formatTime(booking.slotStart ?? "")}. Reference: ${booking.referenceId}`;
  const priceNum = parseFloat(booking.slotPrice ?? booking.servicePrice ?? "0");
  const advanceNum = parseFloat(booking.slotAdvance ?? booking.serviceAdvance ?? "0");
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
            <span className="font-medium text-foreground">{formatTime(booking.slotStart ?? "")} – {formatTime(booking.slotEnd ?? "")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium text-foreground">{booking.playerName}</span>
          </div>
        </div>
      </div>
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
  const { data: facility } = trpc.facility.get.useQuery();

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
              setBooking((prev) => ({
                ...prev,
                slotId: slot.id,
                slotDate: slot.date,
                slotStart: slot.start,
                slotEnd: slot.end,
                slotPrice: slot.slotPrice != null ? String(slot.slotPrice) : undefined,
                slotAdvance: slot.slotAdvance != null ? String(slot.slotAdvance) : undefined,
              }));
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
            facility={facility}
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


