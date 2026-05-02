/**
 * AdminBookingDetail — Full booking review page for the coach.
 * Shows player info, payment screenshot, and confirm/reject/cancel actions.
 */
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  Calendar,
  Clock,
  IndianRupee,
  ArrowLeft,
  ExternalLink,
  MessageCircle,
  Loader2,
  Image as ImageIcon,
  FileText,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import AdminLayout from "./AdminLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { isManualBooking } from "@shared/constants";

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Status rendering is handled by the shared <StatusBadge> component.

function formatTime(t: string | null | undefined) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = (h ?? 0) >= 12 ? "PM" : "AM";
  const hour = (h ?? 0) % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Detail Row ───────────────────────────────────────────────────────────────
function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground mt-0.5">{value}</div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AdminBookingDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const bookingId = parseInt(params.id ?? "0", 10);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [screenshotOpen, setScreenshotOpen] = useState(false);

  const utils = trpc.useUtils();

  // Use adminList and filter by id (getById is an admin procedure)
  const { data: allBookings, isLoading } = trpc.bookings.adminList.useQuery({});
  const booking = allBookings?.find((b) => b.id === bookingId);

  const confirmMutation = trpc.bookings.confirm.useMutation({
    onSuccess: () => {
      toast.success("Booking confirmed! Player will be notified.");
      setConfirmOpen(false);
      utils.bookings.adminList.invalidate();
      utils.bookings.stats.invalidate();
      utils.bookings.todayBookings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = trpc.bookings.reject.useMutation({
    onSuccess: () => {
      toast.success("Booking rejected. Slot is now available again.");
      setRejectOpen(false);
      setAdminNote("");
      utils.bookings.adminList.invalidate();
      utils.bookings.stats.invalidate();
      utils.bookings.todayBookings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelMutation = trpc.bookings.cancel.useMutation({
    onSuccess: () => {
      toast.success("Booking cancelled. Slot is now available again.");
      setCancelOpen(false);
      utils.bookings.adminList.invalidate();
      utils.bookings.stats.invalidate();
      utils.bookings.todayBookings.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // ── Loading ──
  if (isLoading) {
    return (
      <AdminLayout title="Booking Detail">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!booking) {
    return (
      <AdminLayout title="Booking Detail">
        <div className="text-center py-16">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-sm font-medium">Booking not found</p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate("/admin/bookings")}>
            ← Back to Bookings
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const isPending = booking.bookingStatus === "pending";
  const isConfirmed = booking.bookingStatus === "confirmed";
  const isProcessing = confirmMutation.isPending || rejectMutation.isPending || cancelMutation.isPending;

  const whatsappMsg = encodeURIComponent(
    `Hi ${booking.playerName}! Your booking at BestCricketAcademy (Ref: ${booking.referenceId}) has been ${booking.bookingStatus}. Thank you!`
  );

  return (
    <AdminLayout title="Booking Detail">
      {/* ── Back ── */}
      <button
        onClick={() => navigate("/admin/bookings")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Bookings
      </button>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
            {booking.playerName}
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{booking.referenceId}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={booking.bookingStatus as any} />
          <StatusBadge status={booking.paymentStatus as any} size="sm" />
        </div>
      </div>

      {/* ── Manual Booking Banner ── */}
      {isManualBooking(booking) && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 mb-4 flex flex-col gap-0.5">
          <p className="text-xs font-semibold text-amber-800">Manual Booking</p>
          <p className="text-[11px] text-amber-700">Payment not collected via platform.</p>
        </div>
      )}
      {/* ── Booking Details ── */}
      <Card className="border border-border mb-4">

        <CardContent className="p-0 px-4">
          <DetailRow
            icon={<FileText className="w-4 h-4 text-muted-foreground" />}
            label="Service"
            value={(booking as any).serviceName ?? `Service #${booking.serviceId}`}
          />
          <DetailRow
            icon={<Calendar className="w-4 h-4 text-muted-foreground" />}
            label="Date"
            value={formatDate(booking.bookingDate)}
          />
          <DetailRow
            icon={<Clock className="w-4 h-4 text-muted-foreground" />}
            label="Time"
            value={`${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`}
          />
          <DetailRow
            icon={<IndianRupee className="w-4 h-4 text-muted-foreground" />}
            label="Amount"
            value={
              <span className="text-primary font-bold text-base">
                ₹{parseFloat(String(booking.amount)).toLocaleString("en-IN")}
              </span>
            }
          />
          <DetailRow
            icon={<User className="w-4 h-4 text-muted-foreground" />}
            label="Player"
            value={booking.playerName}
          />
          <DetailRow
            icon={<Phone className="w-4 h-4 text-muted-foreground" />}
            label="WhatsApp"
            value={
              <a
                href={`https://wa.me/91${booking.playerWhatsApp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex items-center gap-1"
              >
                {booking.playerWhatsApp}
                <ExternalLink className="w-3 h-3" />
              </a>
            }
          />
          {booking.adminNote && (
            <DetailRow
              icon={<FileText className="w-4 h-4 text-muted-foreground" />}
              label={isManualBooking(booking) ? "Notes" : "Admin Note"}
              value={
                isManualBooking(booking)
                  ? booking.adminNote.replace(/^\[MANUAL\]\s*/, "")
                  : booking.adminNote
              }
            />
          )}

        </CardContent>
      </Card>

      {/* ── Payment Screenshot ── */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Payment Screenshot
        </p>
        {booking.screenshotUrl ? (
          <div
            className="rounded-2xl overflow-hidden border border-border cursor-pointer"
            onClick={() => setScreenshotOpen(true)}
          >
            <img
              src={booking.screenshotUrl}
              alt="Payment screenshot"
              className="w-full max-h-72 object-contain bg-muted"
            />
            <div className="px-3 py-2 bg-muted/50 flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Tap to view full size</span>
              <a
                href={booking.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-primary flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                Open <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <ImageIcon className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No screenshot uploaded yet</p>
          </div>
        )}
      </div>

      {/* ── Action Buttons ── */}
      <div className="space-y-2 mb-3">
        {isPending && (
          <>
            <Button
              className="w-full h-12 rounded-xl font-semibold text-sm"
              disabled={isProcessing}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirm Booking & Payment
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl font-semibold text-sm border-red-200 text-red-600 hover:bg-red-50"
              disabled={isProcessing}
              onClick={() => setRejectOpen(true)}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject Booking
            </Button>
          </>
        )}
        {isConfirmed && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl font-semibold text-sm"
            disabled={isProcessing}
            onClick={() => setCancelOpen(true)}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Cancel Confirmed Booking
          </Button>
        )}
      </div>

      {/* ── WhatsApp Player ── */}
      <a
        href={`https://wa.me/91${booking.playerWhatsApp.replace(/\D/g, "")}?text=${whatsappMsg}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="outline" className="w-full h-11 rounded-xl text-sm">
          <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
          Message Player on WhatsApp
        </Button>
      </a>

      {/* ── Confirm Dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="rounded-2xl mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Booking?</DialogTitle>
            <DialogDescription>
              This will mark the booking as confirmed and the payment as received.
              The slot will remain blocked.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            <p className="text-sm font-medium text-foreground">{booking.playerName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(booking as any).serviceName} · ₹{parseFloat(String(booking.amount)).toLocaleString("en-IN")}
            </p>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
              Go Back
            </Button>
            <Button
              className="flex-1"
              disabled={confirmMutation.isPending}
              onClick={() => confirmMutation.mutate({ id: booking.id })}
            >
              {confirmMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="rounded-2xl mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle>Reject Booking?</DialogTitle>
            <DialogDescription>
              This will reject the booking and free up the slot for other players.
            </DialogDescription>
          </DialogHeader>
          <div className="py-1">
            <label className="text-xs font-medium text-foreground block mb-1.5">
              Reason (optional)
            </label>
            <Textarea
              placeholder="e.g. Payment not received, invalid screenshot..."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="rounded-xl text-sm resize-none"
              rows={3}
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setRejectOpen(false)}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({ id: booking.id, adminNote: adminNote || undefined })}
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Dialog ── */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="rounded-2xl mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Booking?</DialogTitle>
            <DialogDescription>
              This will cancel a confirmed booking and free up the slot.
              Use only if the player has requested a cancellation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setCancelOpen(false)}>
              Keep Booking
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate({ id: booking.id })}
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cancel Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Screenshot Full-Size Modal ── */}
      <Dialog open={screenshotOpen} onOpenChange={setScreenshotOpen}>
        <DialogContent className="rounded-2xl mx-2 max-w-lg p-2">
          <img
            src={booking.screenshotUrl ?? ""}
            alt="Payment screenshot full size"
            className="w-full rounded-xl"
          />
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
