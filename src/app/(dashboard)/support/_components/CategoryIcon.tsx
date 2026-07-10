import { cn } from "@/lib/utils";
import { Bug, HelpCircle, Lightbulb, MessageSquare, Star } from "lucide-react";

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  BUG: Bug,
  QUESTION: HelpCircle,
  FEATURE_REQUEST: Star,
  SUGGESTION: Lightbulb,
  OTHER: MessageSquare,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = icons[category] ?? MessageSquare;
  return <Icon className={cn("h-5 w-5 text-muted-foreground shrink-0", className)} />;
}
