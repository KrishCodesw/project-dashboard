// Pure engine: converts scored attention items into the brief format
// consumed by the presentation layer.

import type {
  BriefAttentionItem,
  ChangeStats,
  CompletedItem,
  DailyBrief,
  Recommendation,
  ScoredAttentionItem,
} from "@/lib/delivery/types";

export function generateBrief(
  sinceLastVisit: ChangeStats,
  recentlyCompleted: CompletedItem[],
  attentionItems: ScoredAttentionItem[],
  recommendations: Recommendation[],
): DailyBrief {
  const topAttention = attentionItems
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(toBriefItem);

  return {
    sinceLastVisit,
    recentlyCompleted,
    attentionItems: topAttention,
    recommendations: recommendations.slice(0, 3),
  };
}

function toBriefItem(item: ScoredAttentionItem): BriefAttentionItem {
  return {
    projectId: item.projectId,
    projectTitle: item.projectTitle,
    message: item.message,
    severity: item.severity,
  };
}
