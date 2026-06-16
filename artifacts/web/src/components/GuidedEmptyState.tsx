import * as React from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GuidedEmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  // Primary action — either navigates (actionHref) or runs a handler (onAction).
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  // Optional secondary action.
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

// The core of the "never a dead end" principle: instead of a blank table, explain
// what's missing in plain language and route the user to the prerequisite step.
export function GuidedEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  onSecondary,
  className,
}: GuidedEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="rounded-full bg-slate-100 p-3">
          <Icon className="h-6 w-6 text-slate-500" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? <p className="max-w-md text-sm leading-relaxed text-slate-500">{description}</p> : null}
      {actionLabel || secondaryLabel ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {actionLabel && actionHref ? (
            <Button asChild>
              <Link href={actionHref}>{actionLabel}</Link>
            </Button>
          ) : null}
          {actionLabel && !actionHref && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
          {secondaryLabel && onSecondary ? (
            <Button variant="outline" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
