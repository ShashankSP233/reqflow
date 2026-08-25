import { Router } from "express";
import { db } from "@workspace/db";
import {
  requisitionsTable, requisitionItemsTable,
  projectsTable, sitesTable, attachmentsTable, queriesTable, queryRepliesTable, statusUpdatesTable,
  holidaysTable, userProjectsTable
} from "@workspace/db";
import { eq, and, sql, inArray, or } from "drizzle-orm";
import { computeCompliance, toDateOnlyIST, todayIST } from "../lib/business-days";
import type { SessionUser } from "../lib/session-types";

const router = Router();

// Project-based data isolation (point 8): purchase_head sees everything;
// everyone else sees requisitions for projects they've been explicitly
// assigned to via Setup > Users — PLUS, always, any requisition they're
// personally part of (raised it, checking it, approving it, or assigned to
// work it), even on a project they aren't formally added to. Without this
// fallback, the person who raises a requisition can lose access to their
// own submission the moment it's created, before anyone's had a chance to
// add them to the project.
async function getAllowedProjectIds(user: SessionUser | undefined): Promise<number[] | "all"> {
  if (!user || user.role === "purchase_head") return "all";
  const rows = await db.select({ project_id: userProjectsTable.project_id }).from(userProjectsTable).where(eq(userProjectsTable.user_id, user.id));
  return rows.map(r => r.project_id);
}

function personalInvolvementCondition(userId: number) {
  return or(
    eq(requisitionsTable.raised_by_id, userId),
    eq(requisitionsTable.checker1_id, userId),
    eq(requisitionsTable.checker2_id, userId),
    eq(requisitionsTable.approver_id, userId),
    eq(requisitionsTable.assigned_to_id, userId),
  );
}

function isPersonallyInvolved(userId: number, r: { raised_by_id: number | null; checker1_id: number | null; checker2_id: number | null; approver_id: number | null; assigned_to_id: number | null }): boolean {
  return r.raised_by_id === userId || r.checker1_id === userId || r.checker2_id === userId || r.approver_id === userId || r.assigned_to_id === userId;
}

// Fixes the "extra space" class of discrepancy automatically for everyone —
// doesn't touch casing/spelling, since that's what the item-name autocomplete
// (GET /item-names, wired into the frontend) is for.
function normalizeItemName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function canEditRequisition(user: SessionUser, r: { raised_by_id: number | null; checker1_id: number | null; checker2_id: number | null; approver_id: number | null; status: string }): boolean {
  if (user.role === "purchase_head") return true;
  const isParty = r.raised_by_id === user.id || r.checker1_id === user.id || r.checker2_id === user.id || r.approver_id === user.id;
  if (!isParty) return false;
  return ["draft", "pending_checkers", "pending_approver", "on_hold"].includes(r.status);
}

function fmt(r: Record<string, unknown>) {
  return {
    ...r,
    created_at: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : r.created_at,
    updated_at: r.updated_at instanceof Date ? (r.updated_at as Date).toISOString() : r.updated_at,
    submitted_at: r.submitted_at instanceof Date ? (r.submitted_at as Date).toISOString() : r.submitted_at ?? null,
    approved_at: r.approved_at instanceof Date ? (r.approved_at as Date).toISOString() : r.approved_at ?? null,
    completed_at: r.completed_at instanceof Date ? (r.completed_at as Date).toISOString() : r.completed_at ?? null,
    assigned_at: r.assigned_at instanceof Date ? (r.assigned_at as Date).toISOString() : r.assigned_at ?? null,
    checker1_reviewed_at: r.checker1_reviewed_at instanceof Date ? (r.checker1_reviewed_at as Date).toISOString() : r.checker1_reviewed_at ?? null,
    checker2_reviewed_at: r.checker2_reviewed_at instanceof Date ? (r.checker2_reviewed_at as Date).toISOString() : r.checker2_reviewed_at ?? null,
    approver_reviewed_at: r.approver_reviewed_at instanceof Date ? (r.approver_reviewed_at as Date).toISOString() : r.approver_reviewed_at ?? null,
    held_at: r.held_at instanceof Date ? (r.held_at as Date).toISOString() : r.held_at ?? null,
  };
}

function fmtItem(item: Record<string, unknown>) {
  return {
    ...item,
    quantity: Number(item.quantity),
    expected_cost: item.expected_cost != null ? Number(item.expected_cost) : null,
  };
}

async function enrichRequisition(row: Record<string, unknown>) {
  const id = row.id as number;
  const itemsAgg = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
      total: sql<number>`COALESCE(SUM(expected_cost), 0)::float`,
    })
    .from(requisitionItemsTable)
    .where(eq(requisitionItemsTable.requisition_id, id));
  return {
    ...fmt(row),
    item_count: itemsAgg[0]?.count ?? 0,
    total_expected_cost: itemsAgg[0]?.total ?? 0,
  };
}

const baseSelect = {
  id: requisitionsTable.id,
  ref_number: requisitionsTable.ref_number,
  project_id: requisitionsTable.project_id,
  project_name: projectsTable.name,
  site_id: requisitionsTable.site_id,
  site_name: requisitionsTable.site_name,
  raised_by_id: requisitionsTable.raised_by_id,
  raised_by_name: requisitionsTable.raised_by_name,
  requisition_date: requisitionsTable.requisition_date,
  priority: requisitionsTable.priority,
  purpose: requisitionsTable.purpose,
  notes: requisitionsTable.notes,
  status: requisitionsTable.status,
  checker1_id: requisitionsTable.checker1_id,
  checker1_name: requisitionsTable.checker1_name,
  checker1_suggestion: requisitionsTable.checker1_suggestion,
  checker1_reviewed_at: requisitionsTable.checker1_reviewed_at,
  checker1_status: requisitionsTable.checker1_status,
  checker2_id: requisitionsTable.checker2_id,
  checker2_name: requisitionsTable.checker2_name,
  checker2_suggestion: requisitionsTable.checker2_suggestion,
  checker2_reviewed_at: requisitionsTable.checker2_reviewed_at,
  checker2_status: requisitionsTable.checker2_status,
  approver_id: requisitionsTable.approver_id,
  approver_name: requisitionsTable.approver_name,
  approver_suggestion: requisitionsTable.approver_suggestion,
  approver_reviewed_at: requisitionsTable.approver_reviewed_at,
  approver_status: requisitionsTable.approver_status,
  hold_reason: requisitionsTable.hold_reason,
  held_at: requisitionsTable.held_at,
  pre_hold_status: requisitionsTable.pre_hold_status,
  purchase_head_id: requisitionsTable.purchase_head_id,
  purchase_head_name: requisitionsTable.purchase_head_name,
  assigned_to_id: requisitionsTable.assigned_to_id,
  assigned_to_name: requisitionsTable.assigned_to_name,
  assigned_at: requisitionsTable.assigned_at,
  submitted_at: requisitionsTable.submitted_at,
  approved_at: requisitionsTable.approved_at,
  completed_at: requisitionsTable.completed_at,
  created_at: requisitionsTable.created_at,
  updated_at: requisitionsTable.updated_at,
};

// ── List ─────────────────────────────────────────────────────────────────────
router.get("/requisitions", async (req, res) => {
  const { status, priority, raised_by_id, assigned_to_id, checker1_id, checker2_id, approver_id, checker_id, project_id, search } = req.query;
  const conditions = [];
  if (status) conditions.push(eq(requisitionsTable.status, String(status)));
  if (priority) conditions.push(eq(requisitionsTable.priority, String(priority)));
  if (raised_by_id) conditions.push(eq(requisitionsTable.raised_by_id, Number(raised_by_id)));
  if (assigned_to_id) conditions.push(eq(requisitionsTable.assigned_to_id, Number(assigned_to_id)));
  if (checker1_id) conditions.push(eq(requisitionsTable.checker1_id, Number(checker1_id)));
  if (checker2_id) conditions.push(eq(requisitionsTable.checker2_id, Number(checker2_id)));
  if (approver_id) conditions.push(eq(requisitionsTable.approver_id, Number(approver_id)));
  if (project_id) conditions.push(eq(requisitionsTable.project_id, Number(project_id)));
  // A checker can be checker1 on one requisition and checker2 on another —
  // this matches either role for the same person in a single query.
  if (checker_id) conditions.push(or(eq(requisitionsTable.checker1_id, Number(checker_id)), eq(requisitionsTable.checker2_id, Number(checker_id))));
  // One unified search across everything a person might remember about a
  // past requisition — ref number, requester, purpose, site, or what was
  // actually requested (item name / vessel-equipment-location).
  if (search) {
    const term = `%${String(search).trim().toLowerCase()}%`;
    conditions.push(or(
      sql`LOWER(${requisitionsTable.ref_number}) LIKE ${term}`,
      sql`LOWER(${requisitionsTable.raised_by_name}) LIKE ${term}`,
      sql`LOWER(COALESCE(${requisitionsTable.purpose}, '')) LIKE ${term}`,
      sql`LOWER(COALESCE(${requisitionsTable.site_name}, '')) LIKE ${term}`,
      sql`EXISTS (
        SELECT 1 FROM requisition_items ri
        WHERE ri.requisition_id = ${requisitionsTable.id}
        AND (LOWER(ri.item_name) LIKE ${term} OR LOWER(COALESCE(ri.asset_name, '')) LIKE ${term})
      )`
    ));
  }

  const allowedProjectIds = await getAllowedProjectIds(req.currentUser);
  if (allowedProjectIds !== "all" && req.currentUser) {
    const projectAccess = allowedProjectIds.length > 0 ? inArray(requisitionsTable.project_id, allowedProjectIds) : undefined;
    const personalAccess = personalInvolvementCondition(req.currentUser.id);
    conditions.push(projectAccess ? or(projectAccess, personalAccess) : personalAccess);
  }

  const rows = await db
    .select(baseSelect)
    .from(requisitionsTable)
    .leftJoin(projectsTable, eq(requisitionsTable.project_id, projectsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sql`${requisitionsTable.created_at} DESC`);

  const enriched = await Promise.all(rows.map(r => enrichRequisition(r as Record<string, unknown>)));
  res.json(enriched);
});

// ── Create ────────────────────────────────────────────────────────────────────
router.post("/requisitions", async (req, res) => {
  const {
    project_id, site_id, raised_by_id, raised_by_name, site_name,
    requisition_date, priority, purpose, notes, items = []
  } = req.body;

  if (!project_id || !raised_by_name || !requisition_date) {
    res.status(400).json({ error: "project_id, raised_by_name and requisition_date are required" });
    return;
  }

  if (requisition_date !== todayIST()) {
    res.status(400).json({ error: "The requisition date must be today — it can't be backdated or postdated." });
    return;
  }

  // Generate ref number: REQ-YYYYMMDD-XXXX
  const dateStr = requisition_date.replace(/-/g, "");
  const countRow = await db.select({ count: sql<number>`COUNT(*)::int` }).from(requisitionsTable);
  const seq = String((countRow[0]?.count ?? 0) + 1).padStart(4, "0");
  const ref_number = `REQ-${dateStr}-${seq}`;

  const [req_row] = await db.insert(requisitionsTable).values({
    ref_number,
    project_id: project_id ?? null,
    site_id: site_id || null,
    raised_by_id: raised_by_id ?? null,
    raised_by_name,
    site_name: site_name ?? null,
    requisition_date,
    priority: priority ?? "medium",
    purpose: purpose ?? null,
    notes: notes ?? null,
    status: "draft",
  }).returning();

  // Insert items if provided
  if (items.length > 0) {
    await db.insert(requisitionItemsTable).values(
      items.map((item: Record<string, unknown>, idx: number) => ({
        requisition_id: req_row.id,
        item_name: normalizeItemName(String(item.item_name)),
        quantity: String(item.quantity ?? 1),
        unit: (item.unit as string) ?? null,
        reference_no: (item.reference_no as string) ?? null,
        expected_cost: item.expected_cost != null ? String(item.expected_cost) : null,
        description: (item.description as string) ?? null,
        remark: (item.remark as string) ?? null,
        asset_id: (item.asset_id as number) ?? null,
        asset_name: (item.asset_name as string) ?? null,
        sort_order: idx,
      }))
    );
  }

  const enriched = await enrichRequisition(req_row as unknown as Record<string, unknown>);
  res.status(201).json(enriched);
});

// ── Get ───────────────────────────────────────────────────────────────────────
router.get("/requisitions/:id", async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db
    .select(baseSelect)
    .from(requisitionsTable)
    .leftJoin(projectsTable, eq(requisitionsTable.project_id, projectsTable.id))
    .where(eq(requisitionsTable.id, id));

  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

  const allowedProjectIds = await getAllowedProjectIds(req.currentUser);
  const hasProjectAccess = allowedProjectIds === "all" || rows[0].project_id == null || allowedProjectIds.includes(rows[0].project_id);
  const hasPersonalAccess = req.currentUser && isPersonallyInvolved(req.currentUser.id, rows[0]);
  if (!hasProjectAccess && !hasPersonalAccess) {
    res.status(403).json({ error: "You don't have access to this project" });
    return;
  }

  const items = await db.select().from(requisitionItemsTable).where(eq(requisitionItemsTable.requisition_id, id)).orderBy(requisitionItemsTable.sort_order);
  const attachments = await db.select().from(attachmentsTable).where(and(eq(attachmentsTable.requisition_id, id), eq(attachmentsTable.context, "requisition")));
  const queries = await db.select().from(queriesTable).where(eq(queriesTable.requisition_id, id)).orderBy(queriesTable.created_at);
  const queryIds = queries.map(q => q.id);
  const replies = queryIds.length > 0 ? await db.select().from(queryRepliesTable).where(inArray(queryRepliesTable.query_id, queryIds)) : [];
  const replyAttachments = replies.length > 0 ? await db.select().from(attachmentsTable).where(and(eq(attachmentsTable.context, "query_reply"), inArray(attachmentsTable.context_id, replies.map(r => r.id)))) : [];
  const statusUpdates = await db.select().from(statusUpdatesTable).where(eq(statusUpdatesTable.requisition_id, id)).orderBy(statusUpdatesTable.created_at);

  let compliance = null;
  if (rows[0].status === "in_progress" && rows[0].assigned_at) {
    const holidayRows = await db.select().from(holidaysTable);
    const holidaySet = new Set(holidayRows.map(h => h.date));
    const lastUpdateDate = statusUpdates.length > 0
      ? statusUpdates.reduce((max, u) => (u.update_date > max ? u.update_date : max), statusUpdates[0].update_date)
      : toDateOnlyIST(rows[0].assigned_at as unknown as Date);
    compliance = computeCompliance(lastUpdateDate, holidaySet, todayIST());
  }

  const baseUrl = process.env.BASE_URL ?? "/api";
  const fmtAttachment = (a: typeof attachments[0]) => ({
    ...a,
    uploaded_at: a.uploaded_at.toISOString(),
    url: `${baseUrl}/files/${a.filename}`,
  });

  const queriesWithReplies = queries.map(q => ({
    ...q,
    created_at: q.created_at.toISOString(),
    resolved_at: q.resolved_at?.toISOString() ?? null,
    replies: replies
      .filter(r => r.query_id === q.id)
      .map(r => ({
        ...r,
        created_at: r.created_at.toISOString(),
        attachments: replyAttachments.filter(a => a.context_id === r.id).map(fmtAttachment),
      })),
    attachments: [],
  }));

  res.json({
    ...fmt(rows[0] as Record<string, unknown>),
    item_count: items.length,
    total_expected_cost: items.reduce((s, i) => s + (i.expected_cost != null ? Number(i.expected_cost) : 0), 0),
    items: items.map(i => fmtItem(i as unknown as Record<string, unknown>)),
    attachments: attachments.map(fmtAttachment),
    queries: queriesWithReplies,
    status_updates: statusUpdates.map(u => ({ ...u, created_at: u.created_at.toISOString() })),
    compliance,
  });
});

// ── Update ────────────────────────────────────────────────────────────────────
router.patch("/requisitions/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { project_id, site_id, raised_by_name, site_name, requisition_date, priority, purpose, notes } = req.body;

  const [existing] = await db.select().from(requisitionsTable).where(eq(requisitionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!req.currentUser || !canEditRequisition(req.currentUser, existing)) {
    res.status(403).json({ error: "You can't edit this requisition at its current stage" });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (project_id !== undefined) updates.project_id = project_id;
  if (site_id !== undefined) updates.site_id = site_id;
  if (raised_by_name !== undefined) updates.raised_by_name = raised_by_name;
  if (site_name !== undefined) updates.site_name = site_name;
  if (requisition_date !== undefined) updates.requisition_date = requisition_date;
  if (priority !== undefined) updates.priority = priority;
  if (purpose !== undefined) updates.purpose = purpose;
  if (notes !== undefined) updates.notes = notes;

  const [updated] = await db.update(requisitionsTable).set(updates).where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await enrichRequisition(updated as unknown as Record<string, unknown>));
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete("/requisitions/:id", async (req, res) => {
  await db.delete(requisitionsTable).where(eq(requisitionsTable.id, Number(req.params.id)));
  res.status(204).send();
});

// ── Items ─────────────────────────────────────────────────────────────────────
// Powers the item-name autocomplete on the create form (prevents spelling
// drift — "Steel Bar" vs "steel bar" vs "Steel  Bar" — by prompting with
// what's already been used, rather than requiring exact re-typing).
router.get("/item-names", async (_req, res) => {
  const rows = await db.selectDistinct({ item_name: requisitionItemsTable.item_name }).from(requisitionItemsTable);

  // Case-insensitive de-dupe: keep the first-seen casing for each distinct name.
  const seen = new Map<string, string>();
  for (const r of rows) {
    const trimmed = normalizeItemName(r.item_name);
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }

  const names = Array.from(seen.values()).sort((a, b) => a.localeCompare(b)).slice(0, 500);
  res.json(names);
});

router.get("/requisitions/:id/items", async (req, res) => {
  const id = Number(req.params.id);
  const items = await db.select().from(requisitionItemsTable).where(eq(requisitionItemsTable.requisition_id, id)).orderBy(requisitionItemsTable.sort_order);
  res.json(items.map(i => fmtItem(i as unknown as Record<string, unknown>)));
});

router.post("/requisitions/:id/items", async (req, res) => {
  const id = Number(req.params.id);
  const { item_name, quantity, unit, reference_no, expected_cost, description, remark, sort_order, asset_id, asset_name } = req.body;
  if (!item_name || quantity == null) { res.status(400).json({ error: "item_name and quantity are required" }); return; }

  const [existing] = await db.select().from(requisitionsTable).where(eq(requisitionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!req.currentUser || !canEditRequisition(req.currentUser, existing)) {
    res.status(403).json({ error: "You can't edit this requisition at its current stage" });
    return;
  }
  const existingItems = await db
    .select({ sort_order: requisitionItemsTable.sort_order })
    .from(requisitionItemsTable)
    .where(eq(requisitionItemsTable.requisition_id, id));

  const nextSortOrder =
    existingItems.length > 0
      ? Math.max(...existingItems.map((item) => item.sort_order ?? 0)) + 1
      : 0;
      
  const [item] = await db.insert(requisitionItemsTable).values({
    requisition_id: id,
    item_name: normalizeItemName(item_name),
    quantity: String(quantity),
    unit: unit ?? null,
    reference_no: reference_no ?? null,
    expected_cost: expected_cost != null ? String(expected_cost) : null,
    description: description ?? null,
    remark: remark ?? null,
    asset_id: asset_id ?? null,
    asset_name: asset_name ?? null,
    sort_order: sort_order ?? nextSortOrder,
  }).returning();
  res.status(201).json(fmtItem(item as unknown as Record<string, unknown>));
});

router.patch("/requisitions/:id/items/:itemId", async (req, res) => {
  const id = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  const { item_name, quantity, unit, reference_no, expected_cost, description, remark, sort_order, asset_id, asset_name } = req.body;

  const [existing] = await db.select().from(requisitionsTable).where(eq(requisitionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (!req.currentUser || !canEditRequisition(req.currentUser, existing)) {
    res.status(403).json({ error: "You can't edit this requisition at its current stage" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (item_name !== undefined) updates.item_name = normalizeItemName(item_name);
  if (quantity !== undefined) updates.quantity = String(quantity);
  if (unit !== undefined) updates.unit = unit;
  if (reference_no !== undefined) updates.reference_no = reference_no;
  if (expected_cost !== undefined) updates.expected_cost = expected_cost != null ? String(expected_cost) : null;
  if (description !== undefined) updates.description = description;
  if (remark !== undefined) updates.remark = remark;
  if (asset_id !== undefined) updates.asset_id = asset_id;
  if (asset_name !== undefined) updates.asset_name = asset_name;
  if (sort_order !== undefined) updates.sort_order = sort_order;
  const [item] = await db.update(requisitionItemsTable).set(updates).where(eq(requisitionItemsTable.id, itemId)).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmtItem(item as unknown as Record<string, unknown>));
});

router.delete("/requisitions/:id/items/:itemId", async (req, res) => {
  await db.delete(requisitionItemsTable).where(eq(requisitionItemsTable.id, Number(req.params.itemId)));
  res.status(204).send();
});

// ── Attachments list ──────────────────────────────────────────────────────────
router.get("/requisitions/:id/attachments", async (req, res) => {
  const id = Number(req.params.id);
  const baseUrl = process.env.BASE_URL ?? "/api";
  const atts = await db.select().from(attachmentsTable).where(eq(attachmentsTable.requisition_id, id));
  res.json(atts.map(a => ({ ...a, uploaded_at: a.uploaded_at.toISOString(), url: `${baseUrl}/files/${a.filename}` })));
});

export default router;
