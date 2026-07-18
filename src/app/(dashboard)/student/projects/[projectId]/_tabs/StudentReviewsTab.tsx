"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getProjectReviews } from "@/server/actions/reviews";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  ClipboardCheck,
  User,
  Calendar,
  Star,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

const statusConfig: Record<string, { label: string; class: string; icon: React.ElementType }> = {
  SCHEDULED: { label: "Scheduled", class: "bg-blue-500/20 text-blue-500 border-blue-500/20", icon: Clock },
  COMPLETED: { label: "Completed", class: "bg-emerald-500/20 text-emerald-500 border-emerald-500/20", icon: CheckCircle2 },
  MISSED: { label: "Missed", class: "bg-red-500/20 text-red-500 border-red-500/20", icon: XCircle },
  RESCHEDULED: { label: "Rescheduled", class: "bg-amber-500/20 text-amber-500 border-amber-500/20", icon: AlertCircle },
};

function StarRating({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = score / 2 >= i + 1;
        const half = score / 2 >= i + 0.5 && score / 2 < i + 1;
        return (
          <Star
            key={i}
            className={`h-4 w-4 ${
              filled
                ? "fill-amber-400 text-amber-400"
                : half
                  ? "fill-amber-400/50 text-amber-400"
                  : "fill-muted text-muted-foreground/30"
            }`}
          />
        );
      })}
      <span className="ml-1 text-sm font-semibold">{score.toFixed(1)}</span>
    </div>
  );
}

export function StudentReviewsTab({ projectId }: { projectId: string }) {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["project-reviews", projectId],
    queryFn: () => getProjectReviews(projectId),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!reviews || reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ClipboardCheck className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground font-medium">No reviews yet</p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          Reviews will appear here once a teacher schedules them.
        </p>
      </div>
    );
  }

  const completedReviews = reviews.filter((r) => r.status === "COMPLETED");
  const avgScore = completedReviews.length > 0
    ? completedReviews.reduce((sum, r) => sum + (r.overallScore ?? 0), 0) / completedReviews.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{reviews.length}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Total</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-emerald-500">{completedReviews.length}</p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Completed</p>
        </div>
        <div className="rounded-lg border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">
            {avgScore > 0 ? avgScore.toFixed(1) : "—"}
          </p>
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-1">Avg Score</p>
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => {
          const cfg = statusConfig[review.status] ?? statusConfig.SCHEDULED;
          const StatusIcon = cfg.icon;

          return (
            <Card key={review.id} className="overflow-hidden">
              {/* Status accent bar */}
              <div className={`h-1 ${review.status === "COMPLETED" ? "bg-emerald-500" : review.status === "MISSED" ? "bg-red-500" : "bg-blue-500"}`} />

              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{review.reviewType}</h3>
                      <Badge variant="outline" className={`text-[10px] font-mono ${cfg.class}`}>
                        <StatusIcon className="h-3 w-3 mr-1 inline" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {review.reviewer?.name ?? "Unknown"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Scheduled: {format(new Date(review.scheduledAt), "MMM d, yyyy")}
                      </span>
                      {review.conductedAt && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Conducted: {format(new Date(review.conductedAt), "MMM d, yyyy")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {review.status === "COMPLETED" && review.overallScore !== null && (
                  <>
                    {/* Overall Score */}
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Overall Score
                        </span>
                        <StarRating score={review.overallScore} />
                      </div>

                      {/* Criteria Breakdown */}
                      {review.criteriaScores.length > 0 && (
                        <div className="space-y-2 mt-3 border-t pt-3">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                            Criteria Breakdown
                          </p>
                          {review.criteriaScores.map((c) => (
                            <div key={c.id} className="flex items-center justify-between gap-4">
                              <span className="text-sm flex-1">{c.criteriaName}</span>
                              <div className="flex items-center gap-3 w-48">
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      c.score >= 7 ? "bg-emerald-500" : c.score >= 4 ? "bg-amber-500" : "bg-red-500"
                                    }`}
                                    style={{ width: `${(c.score / 10) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-mono w-8 text-right tabular-nums">{c.score.toFixed(1)}</span>
                              </div>
                              {c.remarks && (
                                <span className="text-xs text-muted-foreground italic hidden sm:block max-w-[200px] truncate">
                                  {c.remarks}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Feedback */}
                    {review.feedback && (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Feedback
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                          {review.feedback}
                        </p>
                      </div>
                    )}
                  </>
                )}

                {review.status === "MISSED" && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-500/5 p-3 text-sm text-red-600">
                    <XCircle className="h-4 w-4 shrink-0" />
                    This review was missed. Contact your supervisor to reschedule.
                  </div>
                )}

                {review.status === "SCHEDULED" && (
                  <div className="flex items-center gap-2 rounded-lg bg-blue-500/5 p-3 text-sm text-blue-600">
                    <Clock className="h-4 w-4 shrink-0" />
                    A {review.reviewType} review is scheduled for{" "}
                    {format(new Date(review.scheduledAt), "MMMM d, yyyy")}.
                    {review.reviewer?.name && <> Conducted by <strong>{review.reviewer.name}</strong>.</>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
