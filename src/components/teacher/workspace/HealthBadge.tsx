import { cn } from "@/lib/utils";
import type { HealthLevel, TrendDirection } from "@/lib/delivery/types";

const healthStyles: Record<HealthLevel, string> = {
  EXCELLENT:
    "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  HEALTHY:
    "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  WARNING:
    "bg-amber-500/10 text-amber-600 border-amber-500/20",
  CRITICAL:
    "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

const trendIcons: Record<
  TrendDirection,
  { icon: string; className: string }
> = {
  IMPROVING: { icon: "\u2191", className: "text-emerald-500" },
  STABLE: { icon: "\u2192", className: "text-muted-foreground" },
  DECLINING: { icon: "\u2193", className: "text-rose-500" },
};

interface HealthBadgeProps {
  level: HealthLevel;
  trend?: TrendDirection;
  className?: string;
}

export function HealthBadge({ level, trend, className }: HealthBadgeProps) {
  const trendInfo = trend ? trendIcons[trend] : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        healthStyles[level],
        className
      )}
    >
      {level}
      {trendInfo && (
        <span className={trendInfo.className}>{trendInfo.icon}</span>
      )}
    </span>
  );
}
