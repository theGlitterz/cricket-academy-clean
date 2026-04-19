/**
 * StatusBadge — reusable pill badge for booking and payment statuses.
 * Used consistently across player-facing pages and admin pages.
 */

import { cn } from "@/lib/utils";

type BookingStatus = "pending" | "confirmed" | "cancelled" | "rejected";
type PaymentStatus = "pending_review" | "confirmed" | "rejected";
type SlotStatus = "available" | "booked" | "blocked";

type StatusType = BookingStatus | PaymentStatus | SlotStatus;

const STATUS_CONFIG: Record<
  StatusType,
  { label: string; className: string }
> = {
  // Booking statuses
  pending: {
    label: "Pending Review",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 border-red-200",
  },
  // Payment statuses
  pending_review: {
    label: "Awaiting Review",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  // Slot statuses
  available: {
    label: "Available",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  booked: {
    label: "Booked",
    className: "bg-blue-100 text-blue-800 border-blue-200",
  },
  blocked: {
    label: "Blocked",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

interface StatusBadgeProps {
  status: StatusType;
  /** Override the label text */
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({
  status,
  label,
  className,
  size = "md",
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        config.className,
        className
      )}
    >
      {label ?? config.label}
    </span>
  );
}

/** Dot indicator for slot availability in the slot grid */
export function SlotDot({ status }: { status: SlotStatus }) {
  const colors: Record<SlotStatus, string> = {
    available: "bg-emerald-500",
    booked: "bg-blue-500",
    blocked: "bg-slate-400",
  };
  return (
    <span
      className={cn("inline-block h-2 w-2 rounded-full", colors[status])}
    />
  );
}
