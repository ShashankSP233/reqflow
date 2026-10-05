import { Router } from "express";
import { db } from "@workspace/db";
import { requisitionsTable, holidaysTable, projectsTable, statusUpdatesTable, queriesTable } from "@workspace/db";
import { sql, eq, isNotNull, inArray } from "drizzle-orm";
import { computeCompliance, todayIST } from "../lib/business-days";

const router = Router();

router.get("/analytics/summary", async (_req, res) => {
  const rows = await db
    .select({ status: requisitionsTable.status, count: sql<number>`COUNT(*)::int` })
    .from(requisitionsTable)
    .groupBy(requisitionsTable.status);

  const urgentRow = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(requisitionsTable)
    .where(eq(requisitionsTable.priority, "urgent"));

  const requisitionsWithQueriesRow = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(requisitionsTable)
    .where(sql`${requisitionsTable.status} <> 'completed' AND EXISTS (
      WITH RECURSIVE ancestors(id) AS (
        SELECT parent_requisition_id FROM requisition_partial_relations WHERE child_requisition_id = ${requisitionsTable.id}
        UNION ALL
        SELECT relation.parent_requisition_id FROM requisition_partial_relations relation
        INNER JOIN ancestors ON relation.child_requisition_id = ancestors.id
      )
      SELECT 1 FROM queries q
      WHERE q.is_resolved IS FALSE
        AND (q.requisition_id = ${requisitionsTable.id} OR q.requisition_id IN (SELECT id FROM ancestors))
    )`);

  const resolutionRow = await db
    .select({ avg: sql<number>`AVG(EXTRACT(EPOCH FROM (approved_at - created_at))/86400)::float` })
    .from(requisitionsTable)
    .where(sql`approved_at IS NOT NULL`);

  const totalCostRow = await db
    .select({ total: sql<number>`COALESCE(SUM(CASE WHEN ri.expected_cost_is_unit IS TRUE THEN ri.quantity * ri.expected_cost ELSE ri.expected_cost END), 0)::float` })
    .from(sql`requisition_items ri`);

  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) { counts[r.status] = r.count; total += r.count; }

  const pendingStatuses = ["pending_checkers", "pending_approver"];
  const pending = pendingStatuses.reduce((sum, s) => sum + (counts[s] ?? 0), 0);

  res.json({
    total,
    draft: counts["draft"] ?? 0,
    pending,
    on_hold: counts["on_hold"] ?? 0,
    approved: counts["approved"] ?? 0,
    rejected: counts["rejected"] ?? 0,
    in_progress: counts["in_progress"] ?? 0,
    completed: counts["completed"] ?? 0,
    urgent_count: urgentRow[0]?.count ?? 0,
    requisitions_with_queries: requisitionsWithQueriesRow[0]?.count ?? 0,
    avg_resolution_days: resolutionRow[0]?.avg ?? 0,
    total_expected_value: totalCostRow[0]?.total ?? 0,
  });
});

router.get("/analytics/resolution-times", async (_req, res) => {
  const rows = await db
    .select({
      id: requisitionsTable.id,
      ref_number: requisitionsTable.ref_number,
      raised_by_name: requisitionsTable.raised_by_name,
      priority: requisitionsTable.priority,
      status: requisitionsTable.status,
      site_name: requisitionsTable.site_name,
      created_at: requisitionsTable.created_at,
      approved_at: requisitionsTable.approved_at,
      completed_at: requisitionsTable.completed_at,
      resolution_days: sql<number | null>`CASE WHEN ${requisitionsTable.approved_at} IS NOT NULL THEN (EXTRACT(EPOCH FROM (${requisitionsTable.approved_at} - ${requisitionsTable.created_at}))/86400)::float ELSE NULL END`,
    })
    .from(requisitionsTable)
    .orderBy(sql`${requisitionsTable.created_at} DESC`)
    .limit(50);

  res.json(rows.map(r => ({
    ...r,
    created_at: r.created_at.toISOString(),
    approved_at: r.approved_at?.toISOString() ?? null,
    completed_at: r.completed_at?.toISOString() ?? null,
  })));
});

router.get("/analytics/urgent", async (_req, res) => {
  const rows = await db
    .select({
      id: requisitionsTable.id,
      ref_number: requisitionsTable.ref_number,
      raised_by_name: requisitionsTable.raised_by_name,
      assigned_to_name: requisitionsTable.assigned_to_name,
      status: requisitionsTable.status,
      site_name: requisitionsTable.site_name,
      created_at: requisitionsTable.created_at,
      approved_at: requisitionsTable.approved_at,
      resolution_days: sql<number | null>`CASE WHEN ${requisitionsTable.approved_at} IS NOT NULL THEN (EXTRACT(EPOCH FROM (${requisitionsTable.approved_at} - ${requisitionsTable.created_at}))/86400)::float ELSE NULL END`,
    })
    .from(requisitionsTable)
    .where(eq(requisitionsTable.priority, "urgent"))
    .orderBy(sql`${requisitionsTable.created_at} DESC`);

  res.json(rows.map(r => ({
    ...r,
    created_at: r.created_at.toISOString(),
    approved_at: r.approved_at?.toISOString() ?? null,
  })));
});

router.get("/analytics/by-status", async (_req, res) => {
  const rows = await db
    .select({ status: requisitionsTable.status, count: sql<number>`COUNT(*)::int` })
    .from(requisitionsTable)
    .groupBy(requisitionsTable.status);
  res.json(rows);
});

router.get("/analytics/by-site", async (_req, res) => {
  const rows = await db
    .select({
      site_name: sql<string>`COALESCE(${requisitionsTable.site_name}, 'Unspecified')`,
      count: sql<number>`COUNT(*)::int`,
      total_expected: sql<number>`COALESCE((SELECT SUM(CASE WHEN ri.expected_cost_is_unit IS TRUE THEN ri.quantity * ri.expected_cost ELSE ri.expected_cost END) FROM requisition_items ri WHERE ri.requisition_id = ${requisitionsTable.id}), 0)::float`,
    })
    .from(requisitionsTable)
    .groupBy(requisitionsTable.site_name)
    .orderBy(sql`COUNT(*) DESC`);
  res.json(rows);
});

router.get("/analytics/by-project", async (_req, res) => {
  const rows = await db
    .select({
      project_id: requisitionsTable.project_id,
      project_name: sql<string>`COALESCE(${projectsTable.name}, 'Unspecified')`,
      count: sql<number>`COUNT(DISTINCT ${requisitionsTable.id})::int`,
    })
    .from(requisitionsTable)
    .leftJoin(projectsTable, eq(requisitionsTable.project_id, projectsTable.id))
    .groupBy(requisitionsTable.project_id, projectsTable.name)
    .orderBy(sql`COUNT(DISTINCT ${requisitionsTable.id}) DESC`);
  res.json(rows);
});

// Point 11 / 12: visibility into everything currently on hold.
router.get("/analytics/on-hold", async (_req, res) => {
  const rows = await db
    .select({
      id: requisitionsTable.id,
      ref_number: requisitionsTable.ref_number,
      raised_by_name: requisitionsTable.raised_by_name,
      site_name: requisitionsTable.site_name,
      hold_reason: requisitionsTable.hold_reason,
      held_at: requisitionsTable.held_at,
    })
    .from(requisitionsTable)
    .where(eq(requisitionsTable.status, "on_hold"))
    .orderBy(sql`${requisitionsTable.held_at} DESC`);
  res.json(rows.map(r => ({ ...r, held_at: r.held_at?.toISOString() ?? null })));
});

// Point 15: analytics specifically about the daily status-update process —
// who's actually filing updates, and how the stages break down.
router.get("/analytics/status-updates", async (_req, res) => {
  // For each stage (prepared, checked, reviewed by accounts, ...), how long
  // does it typically take to reach it, counted from when the requisition
  // was assigned? Computed in JS from simple queries rather than a nested
  // SQL subquery, to keep this easy to verify is actually correct.
  const rows = await db
    .select({
      requisition_id: statusUpdatesTable.requisition_id,
      stage: statusUpdatesTable.stage,
      created_at: statusUpdatesTable.created_at,
      assigned_at: requisitionsTable.assigned_at,
    })
    .from(statusUpdatesTable)
    .innerJoin(requisitionsTable, eq(requisitionsTable.id, statusUpdatesTable.requisition_id));

  // Keep only the EARLIEST time each requisition reached each stage.
  const firstReached = new Map<string, { stage: string; assignedAt: Date; firstAt: Date }>();
  for (const r of rows) {
    if (!r.assigned_at) continue;
    const key = `${r.requisition_id}::${r.stage}`;
    const existing = firstReached.get(key);
    if (!existing || r.created_at < existing.firstAt) {
      firstReached.set(key, { stage: r.stage, assignedAt: r.assigned_at, firstAt: r.created_at });
    }
  }

  const durationsByStage = new Map<string, number[]>();
  for (const { stage, assignedAt, firstAt } of firstReached.values()) {
    const days = (firstAt.getTime() - assignedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (!durationsByStage.has(stage)) durationsByStage.set(stage, []);
    durationsByStage.get(stage)!.push(Math.max(0, days));
  }

  const by_stage = Array.from(durationsByStage.entries())
    .map(([stage, durations]) => ({
      stage,
      avg_days: Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10,
      requisition_count: durations.length,
    }))
    .sort((a, b) => a.avg_days - b.avg_days);

  res.json({ by_stage });
});

// Point: compare purchase team members — how many requisitions each has
// completed, broken down by priority, and their average completion time
// (measured from assignment, not creation, since checker/approver review
// time upstream isn't something the purchase member controls).
// Purchase team workload: per member, how many requisitions were assigned,
// how many are completed, completion %, average completion time (measured from
// assignment, since upstream review time isn't in the purchase member's control),
// and each member's share of all assigned requisitions.
router.get("/analytics/purchase-member-performance", async (_req, res) => {
  const rows = await db
    .select({
      assigned_to_name: requisitionsTable.assigned_to_name,
      status: requisitionsTable.status,
      assigned_at: requisitionsTable.assigned_at,
      completed_at: requisitionsTable.completed_at,
    })
    .from(requisitionsTable)
    .where(
      sql`${isNotNull(requisitionsTable.assigned_to_name)} AND ${inArray(requisitionsTable.status, ["assigned", "in_progress", "completed"])}`,
    );

  type Entry = { assigned: number; completed: number; totalDays: number; timedCount: number };
  const byMember = new Map<string, Entry>();
  for (const r of rows) {
    if (!r.assigned_to_name) continue;
    if (!byMember.has(r.assigned_to_name)) {
      byMember.set(r.assigned_to_name, { assigned: 0, completed: 0, totalDays: 0, timedCount: 0 });
    }
    const entry = byMember.get(r.assigned_to_name)!;
    entry.assigned += 1;
    if (r.status === "completed") {
      entry.completed += 1;
      if (r.completed_at && r.assigned_at) {
        entry.totalDays += (r.completed_at.getTime() - r.assigned_at.getTime()) / (1000 * 60 * 60 * 24);
        entry.timedCount += 1;
      }
    }
  }

  const grandTotal = Array.from(byMember.values()).reduce((s, e) => s + e.assigned, 0);
  const round1 = (n: number) => Math.round(n * 10) / 10;

  const result = Array.from(byMember.entries())
    .map(([assigned_to_name, e]) => ({
      assigned_to_name,
      total_assigned: e.assigned,
      total_completed: e.completed,
      completion_pct: e.assigned > 0 ? round1((e.completed / e.assigned) * 100) : 0,
      avg_completion_days: e.timedCount > 0 ? round1(e.totalDays / e.timedCount) : 0,
      share_pct: grandTotal > 0 ? round1((e.assigned / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total_assigned - a.total_assigned);

  res.json(result);
});

router.get("/analytics/overdue-updates", async (_req, res) => {
  const holidayRows = await db.select().from(holidaysTable);
  const holidaySet = new Set(holidayRows.map(h => h.date));
  const todayStr = todayIST();

  const rows = await db
    .select({
      id: requisitionsTable.id,
      ref_number: requisitionsTable.ref_number,
      site_name: requisitionsTable.site_name,
      assigned_to_name: requisitionsTable.assigned_to_name,
      assigned_at: requisitionsTable.assigned_at,
      last_update_date: sql<string | null>`(SELECT MAX(su.update_date) FROM status_updates su WHERE su.requisition_id = ${requisitionsTable.id})`,
    })
    .from(requisitionsTable)
    .where(eq(requisitionsTable.status, "in_progress"));

  const withCompliance = rows
    .filter(r => r.assigned_at)
    .map(r => {
      const lastActivityDate = r.last_update_date ?? (r.assigned_at as Date).toISOString().split("T")[0];
      const compliance = computeCompliance(lastActivityDate, holidaySet, todayStr);
      return {
        id: r.id,
        ref_number: r.ref_number,
        site_name: r.site_name,
        assigned_to_name: r.assigned_to_name,
        last_update_date: r.last_update_date,
        business_days_overdue: compliance.business_days_overdue,
        due_today: compliance.due_today,
      };
    })
    .filter(r => r.business_days_overdue > 0)
    .sort((a, b) => b.business_days_overdue - a.business_days_overdue);

  res.json(withCompliance);
});

// Point 9: a fetchable report, restricted to Purchase Head specifically
// (not Approver, unlike the rest of the analytics above).
router.get("/reports/requisitions.csv", async (req, res) => {
  if (req.currentUser?.role !== "purchase_head") {
    res.status(403).json({ error: "Only Purchase Head can generate this report" });
    return;
  }

  const rows = await db
    .select({
      ref_number: requisitionsTable.ref_number,
      project_name: projectsTable.name,
      site_name: requisitionsTable.site_name,
      raised_by_name: requisitionsTable.raised_by_name,
      requisition_date: requisitionsTable.requisition_date,
      priority: requisitionsTable.priority,
      status: requisitionsTable.status,
      assigned_to_name: requisitionsTable.assigned_to_name,
      created_at: requisitionsTable.created_at,
      completed_at: requisitionsTable.completed_at,
    })
    .from(requisitionsTable)
    .leftJoin(projectsTable, eq(requisitionsTable.project_id, projectsTable.id))
    .orderBy(sql`${requisitionsTable.created_at} DESC`);

  function csvEscape(val: unknown): string {
    const s = String(val ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  const header = ["Ref Number", "Project", "Site", "Raised By", "Date", "Priority", "Status", "Assigned To", "Created", "Completed"];
  const csvRows = rows.map(r => [
    r.ref_number, r.project_name ?? "", r.site_name ?? "", r.raised_by_name, r.requisition_date, r.priority, r.status,
    r.assigned_to_name ?? "", r.created_at.toISOString(), r.completed_at?.toISOString() ?? "",
  ]);

  const csv = [header, ...csvRows].map(row => row.map(csvEscape).join(",")).join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="requisitions-report-${todayIST()}.csv"`);
  res.send(csv);
});

export default router;
