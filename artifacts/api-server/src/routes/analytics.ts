import { Router } from "express";
import { db } from "@workspace/db";
import { requisitionsTable, holidaysTable, projectsTable, statusUpdatesTable, queriesTable, requisitionPartialRelationsTable } from "@workspace/db";
import { sql, eq, isNotNull, inArray, and } from "drizzle-orm";
import { computeCompliance, todayIST, toDateOnlyIST } from "../lib/business-days";

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
  // For each stage, measure the time since approval of the immediately
  // preceding stage. Assignment time is the baseline for the first stage.
  // Compute this in JS so missing or out-of-order timestamps can be skipped.
  const rows = await db
    .select({
      requisition_id: statusUpdatesTable.requisition_id,
      stage: statusUpdatesTable.stage,
      created_at: statusUpdatesTable.created_at,
      assigned_at: requisitionsTable.assigned_at,
    })
    .from(statusUpdatesTable)
    .innerJoin(requisitionsTable, eq(requisitionsTable.id, statusUpdatesTable.requisition_id));

  // "Checked by Purchase" is the handoff from approver approval to Purchase
  // Head assignment, so calculate it from workflow timestamps, not a status
  // update submitted by the purchase member.
  const purchaseHandoffRows = await db
    .select({
      approved_at: requisitionsTable.approved_at,
      assigned_at: requisitionsTable.assigned_at,
    })
    .from(requisitionsTable)
    .where(and(isNotNull(requisitionsTable.approved_at), isNotNull(requisitionsTable.assigned_at)));

  const stageOrder = [
    "prepared",
    "checked",
    "reviewed_purchase",
    "accounts_reviewed",
    "reviewed_person1",
    "reviewed_person2",
    "reviewed_person3",
    "reviewed_md",
    "reviewed_chairman",
  ];

  // Keep only the EARLIEST time each requisition reached each stage.
  const firstReached = new Map<string, { stage: string; at: Date }>();
  const assignedAtByRequisition = new Map<number, Date>();
  for (const r of rows) {
    if (r.assigned_at) assignedAtByRequisition.set(r.requisition_id, r.assigned_at);
    const key = `${r.requisition_id}::${r.stage}`;
    const existing = firstReached.get(key);
    if (!existing || r.created_at < existing.at) {
      firstReached.set(key, { stage: r.stage, at: r.created_at });
    }
  }

  const durationsByStage = new Map<string, number[]>();
  const requisitionIds = new Set(rows.map(r => r.requisition_id));
  for (const requisitionId of requisitionIds) {
    for (let index = 0; index < stageOrder.length; index++) {
      const stage = stageOrder[index];
      if (stage === "reviewed_purchase") continue;
      const current = firstReached.get(`${requisitionId}::${stage}`);
      if (!current) continue;

      const previousAt = index === 0
        ? assignedAtByRequisition.get(requisitionId)
        : firstReached.get(`${requisitionId}::${stageOrder[index - 1]}`)?.at;
      if (!previousAt) continue;

      const elapsedMs = current.at.getTime() - previousAt.getTime();
      if (elapsedMs < 0) continue;

      if (!durationsByStage.has(stage)) durationsByStage.set(stage, []);
      durationsByStage.get(stage)!.push(elapsedMs / (1000 * 60 * 60 * 24));
    }
  }

  const purchaseHandoffDurations = purchaseHandoffRows.flatMap(({ approved_at, assigned_at }) => {
    if (!approved_at || !assigned_at) return [];
    const elapsedMs = assigned_at.getTime() - approved_at.getTime();
    return elapsedMs >= 0 ? [elapsedMs / (1000 * 60 * 60 * 24)] : [];
  });
  durationsByStage.set("reviewed_purchase", purchaseHandoffDurations);

  const by_stage = stageOrder.map(stage => {
    const durations = durationsByStage.get(stage) ?? [];
    return {
      stage,
      avg_days: durations.length
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      requisition_count: durations.length,
    };
  });

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
    })
    .from(requisitionsTable)
    .where(eq(requisitionsTable.status, "in_progress"));

  // Resolve inherited updates the same way as the requisition detail route:
  // include the requisition itself and each parent in its continuation chain.
  const relations = await db
    .select({
      child_id: requisitionPartialRelationsTable.child_requisition_id,
      parent_id: requisitionPartialRelationsTable.parent_requisition_id,
    })
    .from(requisitionPartialRelationsTable);
  const parentByChild = new Map(relations.map(relation => [relation.child_id, relation.parent_id]));
  const lineageByRequisition = new Map<number, Set<number>>();
  const lineageIds = new Set<number>();
  for (const requisition of rows) {
    const lineage = new Set([requisition.id]);
    let currentId = requisition.id;
    while (parentByChild.has(currentId)) {
      const parentId = parentByChild.get(currentId)!;
      if (lineage.has(parentId)) break;
      lineage.add(parentId);
      currentId = parentId;
    }
    lineageByRequisition.set(requisition.id, lineage);
    for (const id of lineage) lineageIds.add(id);
  }

  const statusRows = lineageIds.size > 0
    ? await db
      .select({ requisition_id: statusUpdatesTable.requisition_id, created_at: statusUpdatesTable.created_at })
      .from(statusUpdatesTable)
      .where(inArray(statusUpdatesTable.requisition_id, Array.from(lineageIds)))
    : [];
  const latestUpdateByRequisition = new Map<number, Date>();
  for (const update of statusRows) {
    const existing = latestUpdateByRequisition.get(update.requisition_id);
    if (!existing || update.created_at > existing) {
      latestUpdateByRequisition.set(update.requisition_id, update.created_at);
    }
  }

  const withCompliance = rows
    .filter(r => r.assigned_at)
    .map(r => {
      // Use the same created_at timestamps shown in the status update history.
      let lastUpdateAt: Date | undefined;
      for (const id of lineageByRequisition.get(r.id) ?? [r.id]) {
        const candidate = latestUpdateByRequisition.get(id);
        if (candidate && (!lastUpdateAt || candidate > lastUpdateAt)) lastUpdateAt = candidate;
      }
      const lastActivityDate = lastUpdateAt
        ? toDateOnlyIST(lastUpdateAt)
        : toDateOnlyIST(r.assigned_at as Date);
      const compliance = computeCompliance(lastActivityDate, holidaySet, todayStr);
      return {
        id: r.id,
        ref_number: r.ref_number,
        site_name: r.site_name,
        assigned_to_name: r.assigned_to_name,
        last_update_date: lastUpdateAt ? lastActivityDate : null,
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
