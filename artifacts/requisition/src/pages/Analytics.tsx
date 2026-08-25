import { useGetAnalyticsSummary, useGetResolutionTimes, useGetUrgentAnalytics, useGetAnalyticsByStatus, useGetAnalyticsBySite, useGetOverdueStatusUpdates, useGetAnalyticsByProject, useGetStatusUpdateAnalytics, useGetPurchaseMemberPerformance } from "@workspace/api-client-react";
import { formatINR, formatDate, daysBetween } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/requisition/StatusBadge";
import { PriorityBadge } from "@/components/requisition/PriorityBadge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useRole } from "@/context/RoleContext";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ClipboardList, Download, Users } from "lucide-react";

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#a855f7", "#10b981", "#ef4444", "#06b6d4", "#14b8a6"];

const STAGE_LABELS: Record<string, string> = {
  prepared: "Prepared",
  checked: "Checked",
  accounts_reviewed: "Reviewed by Accounts",
  reviewed_person1: "Reviewed by Person 1",
  reviewed_person2: "Reviewed by Person 2",
  reviewed_person3: "Reviewed by Person 3",
  reviewed_md: "Reviewed by MD",
  reviewed_chairman: "Reviewed by Chairman",
};

export default function Analytics() {
  const { user } = useRole();
  const { data: summary, isLoading } = useGetAnalyticsSummary();
  const { data: resTimes } = useGetResolutionTimes();
  const { data: urgentList } = useGetUrgentAnalytics();
  const { data: byStatus } = useGetAnalyticsByStatus();
  const { data: bySite } = useGetAnalyticsBySite();
  const { data: byProject } = useGetAnalyticsByProject();
  const { data: overdueUpdates } = useGetOverdueStatusUpdates();
  const { data: statusUpdateStats } = useGetStatusUpdateAnalytics();
  const { data: memberPerformance } = useGetPurchaseMemberPerformance();

  if (!["approver", "purchase_head"].includes(user.role)) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center mt-16">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground mt-2">Analytics are only available to the Approver and Purchase Head.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Procurement performance metrics — restricted access</p>
        </div>
        {user.role === "purchase_head" && (
          <a href="/api/reports/requisitions.csv" download>
            <Button variant="outline" size="sm" className="gap-2" data-testid="button-download-report">
              <Download className="w-4 h-4" />
              Download Report
            </Button>
          </a>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Total", value: summary?.total ?? 0 },
          { label: "Pending", value: summary?.pending ?? 0 },
          { label: "Approved", value: summary?.approved ?? 0 },
          { label: "Rejected", value: summary?.rejected ?? 0 },
          { label: "Avg Days to Approve", value: `${summary?.avg_resolution_days != null ? Number(summary.avg_resolution_days).toFixed(1) : "—"}d` },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4">
              {isLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold">{k.value}</p>}
              <p className="text-xs text-muted-foreground mt-1">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* By Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Requisitions by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {byStatus && (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={byStatus.map(s => ({ name: s.status, value: s.count }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By Site Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Requisitions by Site</CardTitle>
            <CardDescription>Count of requisitions per site</CardDescription>
          </CardHeader>
          <CardContent>
            {bySite && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bySite.map(s => ({ name: s.site_name.length > 15 ? s.site_name.slice(0, 15) + "…" : s.site_name, count: s.count }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By Project Bar */}
      {byProject && byProject.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Requisitions by Project</CardTitle>
            <CardDescription>Count of requisitions per project</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byProject.map(p => ({ name: p.project_name.length > 18 ? p.project_name.slice(0, 18) + "…" : p.project_name, count: p.count }))}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Urgent Requisitions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Urgent Requisitions
          </CardTitle>
          <CardDescription>All urgent priority requisitions — who handled them and how fast</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Ref No.</TableHead>
                <TableHead>Raised By</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead className="text-right">Days to Approve</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!urgentList?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No urgent requisitions.</TableCell></TableRow>
              ) : urgentList.map(r => (
                <TableRow key={r.id} data-testid={`row-urgent-${r.id}`}>
                  <TableCell><Link href={`/requisitions/${r.id}`} className="font-mono text-primary hover:underline">{r.ref_number}</Link></TableCell>
                  <TableCell>{r.raised_by_name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.site_name ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-sm">{formatDate(r.created_at)}</TableCell>
                  <TableCell>{r.assigned_to_name ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {r.resolution_days != null ? (
                      <span className={Number(r.resolution_days) > 3 ? "text-red-600" : "text-emerald-600"}>{Number(r.resolution_days).toFixed(1)}d</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Status Update Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-red-500" />
            Status Update Compliance
          </CardTitle>
          <CardDescription>Purchase team members behind on their daily status update (weekends &amp; holidays excluded)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Ref No.</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Last Update</TableHead>
                <TableHead className="text-right">Business Days Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!overdueUpdates?.length ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Everyone is up to date. 🎉</TableCell></TableRow>
              ) : overdueUpdates.map(r => (
                <TableRow key={r.id} data-testid={`row-overdue-${r.id}`}>
                  <TableCell><Link href={`/requisitions/${r.id}`} className="font-mono text-primary hover:underline">{r.ref_number}</Link></TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.site_name ?? "—"}</TableCell>
                  <TableCell>{r.assigned_to_name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.last_update_date ? formatDate(r.last_update_date) : "Never"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{r.business_days_overdue}d overdue</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Status Update Stage Timing (point 15) */}
      {statusUpdateStats && statusUpdateStats.by_stage?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" />
              Average Time to Reach Each Stage
            </CardTitle>
            <CardDescription>Days from assignment to first reaching each status-update stage, averaged across requisitions</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusUpdateStats.by_stage.map(s => ({ name: STAGE_LABELS[s.stage] ?? s.stage, days: s.avg_days, n: s.requisition_count }))} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: "Avg days", position: "insideBottom", offset: -5, fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={140} />
                <Tooltip formatter={(value: number, _name, item) => [`${value} days (${item.payload.n} requisition${item.payload.n > 1 ? "s" : ""})`, "Avg time to reach"]} />
                <Bar dataKey="days" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Purchase Member Performance */}
      {memberPerformance && memberPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Purchase Member Performance
            </CardTitle>
            <CardDescription>Completed requisitions per team member, by priority, and average time from assignment to completion</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Urgent</TableHead>
                  <TableHead className="text-right">High</TableHead>
                  <TableHead className="text-right">Medium</TableHead>
                  <TableHead className="text-right">Low</TableHead>
                  <TableHead className="text-right">Avg Days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberPerformance.map((m, i) => (
                  <TableRow key={i} data-testid={`row-member-performance-${i}`}>
                    <TableCell className="font-medium text-sm">{m.assigned_to_name}</TableCell>
                    <TableCell className="text-right font-medium">{m.total_completed}</TableCell>
                    <TableCell className="text-right text-red-600">{m.urgent}</TableCell>
                    <TableCell className="text-right text-amber-600">{m.high}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{m.medium}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{m.low}</TableCell>
                    <TableCell className="text-right">{m.avg_completion_days}d</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Resolution Times Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resolution Time per Requisition</CardTitle>
          <CardDescription>Time from creation to approval (most recent 50)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Ref No.</TableHead>
                <TableHead>Raised By</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Approved</TableHead>
                <TableHead className="text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!resTimes?.length ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No data.</TableCell></TableRow>
              ) : resTimes.map(r => (
                <TableRow key={r.id} data-testid={`row-resolution-${r.id}`}>
                  <TableCell><Link href={`/requisitions/${r.id}`} className="font-mono text-primary hover:underline text-xs">{r.ref_number}</Link></TableCell>
                  <TableCell className="text-sm">{r.raised_by_name}</TableCell>
                  <TableCell><PriorityBadge priority={r.priority} /></TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.approved_at ? formatDate(r.approved_at) : "—"}</TableCell>
                  <TableCell className="text-right">
                    {r.resolution_days != null ? (
                      <span className={`font-medium ${Number(r.resolution_days) > 7 ? "text-red-600" : Number(r.resolution_days) > 3 ? "text-amber-600" : "text-emerald-600"}`}>{Number(r.resolution_days).toFixed(1)}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
