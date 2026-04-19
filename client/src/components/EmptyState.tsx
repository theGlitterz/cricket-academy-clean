/**
 * EmptyState — reusable empty state component for all list pages.
 * Provides a consistent, friendly empty state with icon, title, and optional CTA.
 */

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-base font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mb-4 max-w-xs text-sm text-slate-500">{description}</p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

/** Inline empty state for smaller containers */
export function InlineEmptyState({
  icon,
  title,
  description,
}: Omit<EmptyStateProps, "action" | "className">) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      {icon && <div className="mb-2 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-500">{title}</p>
      {description && (
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      )}
    </div>
  );
}
