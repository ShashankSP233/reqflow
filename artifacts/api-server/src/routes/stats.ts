import { Router } from "express";
import { db } from "@workspace/db";
import { requisitionsTable, departmentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/stats/summary", async (_req, res) => {
  const rows = await db
    .select({
      status: requisitionsTable.status,
      count: sql<number>`COUNT(*)::int`,
      total: sql<number>`COALESCE(SUM(${requisitionsTable.total_amount}), 0)::float`,
    })
    .from(requisitionsTable)
    .groupBy(requisitionsTable.status);

  const summary = {
    total_requisitions: 0,
    pending_count: 0,
    approved_count: 0,
    rejected_count: 0,
    draft_count: 0,
    fulfilled_count: 0,
    total_value: 0,
    pending_value: 0,
    approved_value: 0,
  };

  for (const row of rows) {
    summary.total_requisitions += row.count;
    summary.total_value += row.total;
    if (row.status === "pending") { summary.pending_count = row.count; summary.pending_value = row.total; }
    if (row.status === "approved") { summary.approved_count = row.count; summary.approved_value = row.total; }
    if (row.status === "rejected") summary.rejected_count = row.count;
    if (row.status === "draft") summary.draft_count = row.count;
    if (row.status === "fulfilled") summary.fulfilled_count = row.count;
  }

  res.json(summary);
});

router.get("/stats/recent", async (_req, res) => {
  const rows = await db
    .select({
      id: requisitionsTable.id,
      title: requisitionsTable.title,
      description: requisitionsTable.description,
      requester_name: requisitionsTable.requester_name,
      requester_email: requisitionsTable.requester_email,
      department_id: requisitionsTable.department_id,
      department_name: departmentsTable.name,
      status: requisitionsTable.status,
      priority: requisitionsTable.priority,
      total_amount: requisitionsTable.total_amount,
      notes: requisitionsTable.notes,
      approver_name: requisitionsTable.approver_name,
      approval_notes: requisitionsTable.approval_notes,
      approved_at: requisitionsTable.approved_at,
      created_at: requisitionsTable.created_at,
      updated_at: requisitionsTable.updated_at,
    })
    .from(requisitionsTable)
    .leftJoin(departmentsTable, eq(requisitionsTable.department_id, departmentsTable.id))
    .orderBy(sql`${requisitionsTable.created_at} DESC`)
    .limit(10);

  res.json(rows.map(formatRequisition));
});

router.get("/stats/by-department", async (_req, res) => {
  const rows = await db
    .select({
      department_id: requisitionsTable.department_id,
      department_name: sql<string>`COALESCE(${departmentsTable.name}, 'No Department')`,
      count: sql<number>`COUNT(*)::int`,
      total_value: sql<number>`COALESCE(SUM(${requisitionsTable.total_amount}), 0)::float`,
    })
    .from(requisitionsTable)
    .leftJoin(departmentsTable, eq(requisitionsTable.department_id, departmentsTable.id))
    .groupBy(requisitionsTable.department_id, departmentsTable.name)
    .orderBy(sql`COUNT(*) DESC`);

  res.json(rows);
});

function formatRequisition(row: Record<string, unknown>) {
  return {
    ...row,
    total_amount: Number(row.total_amount ?? 0),
    approved_at: row.approved_at ? (row.approved_at as Date).toISOString() : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

export default router;
