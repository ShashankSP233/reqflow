import { Badge } from "@/components/ui/badge";

interface PriorityBadgeProps {
  priority?: string | null;
  className?: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-slate-100 text-slate-600 hover:bg-slate-100 border-slate-200" },
  medium: { label: "Medium", className: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200" },
  high: { label: "High", className: "bg-orange-50 text-orange-700 hover:bg-orange-50 border-orange-200" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-700 hover:bg-red-100 border-red-300 font-semibold" },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (!priority) return null;
  const config = PRIORITY_CONFIG[priority] ?? { label: priority, className: "bg-gray-50 text-gray-700 border-gray-200" };
  return (
    <Badge variant="outline" className={`${config.className} ${className ?? ""} text-xs`} data-testid={`priority-badge-${priority}`}>
      {config.label}
    </Badge>
  );
}
