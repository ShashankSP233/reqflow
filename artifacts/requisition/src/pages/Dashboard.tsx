import { useGetAnalyticsSummary, useListRequisitions, useGetOnHoldRequisitions } from "@workspace/api-client-react";
import { formatINR, formatDate } from "@/lib/format";
import { Link } from "wouter";
import { StatusBadge } from "@/components/requisition/StatusBadge";
import { PriorityBadge } from "@/components/requisition/PriorityBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, FileText, CheckCircle2, AlertTriangle, Hourglass, PlusCircle, PauseCircle, MessageSquareText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRole } from "@/context/RoleContext";

export default function Dashboard() {
  const { user } = useRole();
  const { data: summary, isLoading: sumLoading } = useGetAnalyticsSummary();
  const { data: recent, isLoading: recentLoading } = useListRequisitions();
  const { data: onHold, isLoading: onHoldLoading } = useGetOnHoldRequisitions();

  const statCards = [
    {
      label: "Total Requisitions",
      value: summary?.total ?? 0,
      sub: `${summary?.draft ?? 0} draft · ${summary?.pending ?? 0} pending`,
      icon: FileText,
      iconClass: "text-blue-600",
    },
    {
      label: "Pending Approval",
      value: summary?.pending ?? 0,
      sub: "Awaiting checker / approver action",
      icon: Hourglass,
      iconClass: "text-amber-600",
    },
    {
      label: "Approved",
      value: summary?.approved ?? 0,
      sub: "Ready for purchase team",
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
    },
    {
      label: "Urgent Open",
      value: summary?.urgent_count ?? 0,
      sub: "Requires immediate attention",
      icon: AlertTriangle,
      iconClass: "text-red-600",
    },
    {
      label: "On Hold",
      value: summary?.on_hold ?? 0,
      sub: "Paused at the approver stage",
      icon: PauseCircle,
      iconClass: "text-orange-600",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Welcome back, {user.name}</p>
        </div>
        {user.role === "site_user" && (
          <Link href="/requisitions/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors" data-testid="button-new-requisition">
            <PlusCircle className="w-4 h-4" />
            New Requisition
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.iconClass}`} />
            </CardHeader>
            <CardContent>
              {sumLoading ? <Skeleton className="h-8 w-16" /> : (
                <div className="text-3xl font-bold" data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, "-")}`}>{s.value}</div>
              )}
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {onHold && onHold.length > 0 && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PauseCircle className="w-4 h-4 text-orange-600" />
              On Hold ({onHold.length})
            </CardTitle>
            <CardDescription>Paused at the approver stage — waiting on a decision</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {onHold.map(r => (
                <Link key={r.id} href={`/requisitions/${r.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-orange-100 bg-orange-50/40 hover:bg-orange-50 transition-colors cursor-pointer" data-testid={`card-on-hold-${r.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{r.ref_number} <span className="text-muted-foreground font-normal">· {r.raised_by_name}</span></p>
                      {r.hold_reason && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.hold_reason}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground ml-3 flex-shrink-0">{r.held_at ? formatDate(r.held_at) : ""}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Avg. Resolution Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{summary.avg_resolution_days?.toFixed(1) ?? "—"} days</span>
                <span className="text-sm text-muted-foreground ml-2">from creation to approval</span>
              </div>
            </CardContent>
          </Card>
          <Link href="/requisitions?has_queries=true" className="block" data-testid="link-requisitions-with-queries">
            <Card className="h-full transition-colors hover:bg-accent/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Requisitions with Open Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-5 h-5 text-blue-600" />
                  <span className="text-2xl font-bold">{summary.requisitions_with_queries}</span>
                  <span className="text-sm text-muted-foreground ml-2">View requests awaiting query replies</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Requisitions</CardTitle>
            <Link href="/requisitions" className="text-sm text-primary hover:underline" data-testid="link-view-all">View all</Link>
          </div>
          <CardDescription>Last 10 created or updated requests</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : !recent?.length ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No requisitions yet.</div>
          ) : (
            <div className="space-y-2">
              {recent.slice(0, 6).map(req => (
                <Link key={req.id} href={`/requisitions/${req.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/40 transition-colors cursor-pointer" data-testid={`card-recent-${req.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{req.ref_number}</p>
                      <p className="text-xs text-muted-foreground truncate">{req.raised_by_name} · {req.site_name ?? "—"} · {formatDate(req.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <PriorityBadge priority={req.priority} />
                      <StatusBadge status={req.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
