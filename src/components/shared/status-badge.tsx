import { cn } from "@/lib/utils";

/**
 * Coloured status pill. `color` is a semantic token stored on lookup values
 * (green, sky, amber, orange, red, violet, slate) or derived from enum statuses.
 */
const COLORS: Record<string, string> = {
  green: "bg-emerald-500/12 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300",
  sky: "bg-sky-500/12 text-sky-700 ring-sky-600/20 dark:text-sky-300",
  blue: "bg-blue-500/12 text-blue-700 ring-blue-600/20 dark:text-blue-300",
  amber: "bg-amber-500/15 text-amber-800 ring-amber-600/20 dark:text-amber-300",
  orange: "bg-orange-500/12 text-orange-700 ring-orange-600/20 dark:text-orange-300",
  red: "bg-red-500/12 text-red-700 ring-red-600/20 dark:text-red-300",
  violet: "bg-violet-500/12 text-violet-700 ring-violet-600/20 dark:text-violet-300",
  slate: "bg-slate-500/12 text-slate-700 ring-slate-600/20 dark:text-slate-300",
};
export const BADGE_COLORS = Object.keys(COLORS);

/** Enum status → colour. */
export const STATUS_COLOR: Record<string, string> = {
  DRAFT: "slate", ACTIVE: "green", EXPIRED: "orange", CANCELLED: "red",
  PENDING: "amber", PAID: "green", OVERDUE: "red",
  NEW: "sky", UNDER_STUDY: "violet", QUOTED: "blue", APPROVED: "green", IN_PROGRESS: "amber", DELIVERED: "green", CLOSED: "slate", REJECTED: "red",
  SENT: "blue", ACCEPTED: "green",
  LOW: "slate", MEDIUM: "sky", HIGH: "orange", URGENT: "red",
};

export function StatusBadge({ color, children, className }: { color?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        COLORS[color ?? "slate"] ?? COLORS.slate,
        className,
      )}
    >
      {children}
    </span>
  );
}
