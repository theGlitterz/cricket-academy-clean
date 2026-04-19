/**
 * PageLoader — reusable loading skeleton components.
 * Used on all data-fetching pages to provide a smooth loading experience.
 */

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-slate-200",
        className
      )}
    />
  );
}

/** Full-page centered spinner */
export function PageSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cricket-green border-t-transparent" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

/** Booking card skeleton for list pages */
export function BookingCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <div className="mt-3 flex gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

/** Stats card skeleton for the dashboard */
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <Skeleton className="mb-2 h-3 w-16" />
      <Skeleton className="h-8 w-12" />
    </div>
  );
}

/** Slot card skeleton for the slot grid */
export function SlotCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <Skeleton className="mb-1 h-4 w-20" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

/** Service card skeleton for the booking page */
export function ServiceCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
          <div className="flex gap-3 pt-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}
