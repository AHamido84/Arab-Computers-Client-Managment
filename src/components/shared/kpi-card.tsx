import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "accent" | "danger" | "success";
  hint?: React.ReactNode;
}) {
  const toneCls = {
    default: "bg-secondary text-secondary-foreground",
    accent: "bg-accent text-accent-foreground",
    danger: "bg-destructive/10 text-destructive",
    success: "bg-success/10 text-success",
  }[tone];
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="num truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", toneCls)}>
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}
