import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-500",
  resolved: "bg-green-500/10 text-green-500",
  pending: "bg-yellow-500/10 text-yellow-500",
  closed: "bg-gray-500/10 text-gray-500",
  spam: "bg-red-500/10 text-red-500",
};

export function TicketStatusBadge({ status }: { status: string }) {
  const style = statusStyles[status.toLowerCase()] ?? "bg-gray-500/10 text-gray-500";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", style)}>
      {status}
    </span>
  );
}
