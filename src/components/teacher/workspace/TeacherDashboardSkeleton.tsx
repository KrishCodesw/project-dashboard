import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ScaleTier = "SMALL" | "MEDIUM" | "LARGE";

interface TeacherDashboardSkeletonProps {
  scaleTier?: ScaleTier;
}

export function TeacherDashboardSkeleton({
  scaleTier = "MEDIUM",
}: TeacherDashboardSkeletonProps) {
  const projectCount = scaleTier === "LARGE" ? 6 : scaleTier === "SMALL" ? 2 : 3;
  const reviewCount = scaleTier === "LARGE" ? 4 : 2;

  return (
    <div className="space-y-8" aria-label="Loading dashboard">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-[60%]" />
        <Skeleton className="h-4 w-[40%]" />
      </div>

      {/* Daily Brief */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <Skeleton className="h-5 w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Immediate Actions */}
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>

      {/* My Projects */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/4" />
        <div
          className={cn(
            "grid gap-4",
            "sm:grid-cols-2",
            projectCount >= 3 && "lg:grid-cols-3"
          )}
        >
          {Array.from({ length: projectCount }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Reviews */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-1/4" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: reviewCount }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
