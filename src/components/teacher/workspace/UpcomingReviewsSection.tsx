"use client";

import { ClipboardCheck } from "lucide-react";
import { ReviewCard } from "./ReviewCard";
import { EmptySectionState } from "./EmptySectionState";
import type { ReviewCardData } from "@/lib/delivery/types";

interface UpcomingReviewsSectionProps {
  reviews: ReviewCardData[];
}

export function UpcomingReviewsSection({
  reviews,
}: UpcomingReviewsSectionProps) {
  if (reviews.length === 0) {
    return (
      <section>
        <SectionTitle count={0} />
        <EmptySectionState
          icon={ClipboardCheck}
          title="No reviews scheduled"
          description="Schedule a review for an active project."
          action={{ label: "View Projects", href: "/teacher/projects" }}
        />
      </section>
    );
  }

  return (
    <section>
      <SectionTitle count={reviews.length} />
      <div className="grid gap-4 md:grid-cols-2">
        {reviews.map((review, i) => (
          <ReviewCard
            key={review.id}
            id={review.id}
            projectId={review.projectId}
            projectTitle={review.projectTitle}
            reviewType={review.reviewType}
            scheduledAt={review.scheduledAt}
            daysUntil={review.daysUntil}
            studentCount={review.studentCount}
            readiness={review.readiness}
            index={i}
          />
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <ClipboardCheck className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">
        Upcoming Reviews
      </h2>
      {count > 0 && (
        <span className="text-[11px] text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
