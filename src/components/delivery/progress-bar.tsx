import { cn } from "@/lib/utils";

/** Accessible progress bar (0–100). */
export function ProgressBar({ value, label, className, tone }: { value: number; label: string; className?: string; tone?: "default" | "success" | "danger" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", tone === "success" ? "bg-success" : tone === "danger" ? "bg-destructive" : "bg-primary")}
          style={{ width: `${v}%` }}
        />
      </div>
      <span className="num w-10 text-end text-xs text-muted-foreground">{v}%</span>
    </div>
  );
}
