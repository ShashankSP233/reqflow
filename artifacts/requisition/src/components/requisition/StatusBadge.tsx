import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200" },
  pending_checkers: { label: "Pending Checkers", className: "bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200" },
  pending_approver: { label: "Pending Approval", className: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200" },
  on_hold: { label: "On Hold", className: "bg-orange-50 text-orange-700 hover:bg-orange-50 border-orange-200" },
  approved: { label: "Approved", className: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200" },
  assigned: { label: "Assigned", className: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200" },
  in_progress: { label: "In Progress", className: "bg-sky-50 text-sky-700 hover:bg-sky-50 border-sky-200" },
  completed: { label: "Completed", className: "bg-teal-50 text-teal-700 hover:bg-teal-50 border-teal-200" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-50 text-gray-700 border-gray-200" };
  return (
    <Badge variant="outline" className={`${config.className} ${className ?? ""} font-medium text-xs`} data-testid={`status-badge-${status}`}>
      {config.label}
    </Badge>
  );
}
