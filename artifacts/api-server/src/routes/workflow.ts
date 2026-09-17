import { Router } from "express";
import { db } from "@workspace/db";
import { requisitionsTable, requisitionItemsTable, approvalNotesTable, statusUpdatesTable, requisitionPartialRelationsTable, requisitionPartialRelationItemsTable } from "@workspace/db";
import { eq, max, inArray } from "drizzle-orm";
import { todayIST } from "../lib/business-days";

const router = Router();

async function getRelationLineage(id: number) {
  const lineage = [id];
  let currentId = id;
  while (true) {
    const [relation] = await db.select({ parent_requisition_id: requisitionPartialRelationsTable.parent_requisition_id })
      .from(requisitionPartialRelationsTable)
      .where(eq(requisitionPartialRelationsTable.child_requisition_id, currentId))
      .limit(1);
    if (!relation) break;
    lineage.push(relation.parent_requisition_id);
    currentId = relation.parent_requisition_id;
  }
  return lineage.reverse();
}

function fmt(r: Record<string, unknown>) {
  return {
    ...r,
    created_at: r.created_at instanceof Date ? (r.created_at as Date).toISOString() : r.created_at,
    updated_at: r.updated_at instanceof Date ? (r.updated_at as Date).toISOString() : r.updated_at,
    submitted_at: r.submitted_at instanceof Date ? (r.submitted_at as Date).toISOString() : (r.submitted_at ?? null),
    approved_at: r.approved_at instanceof Date ? (r.approved_at as Date).toISOString() : (r.approved_at ?? null),
    completed_at: r.completed_at instanceof Date ? (r.completed_at as Date).toISOString() : (r.completed_at ?? null),
    assigned_at: r.assigned_at instanceof Date ? (r.assigned_at as Date).toISOString() : (r.assigned_at ?? null),
    checker1_reviewed_at: r.checker1_reviewed_at instanceof Date ? (r.checker1_reviewed_at as Date).toISOString() : (r.checker1_reviewed_at ?? null),
    checker2_reviewed_at: r.checker2_reviewed_at instanceof Date ? (r.checker2_reviewed_at as Date).toISOString() : (r.checker2_reviewed_at ?? null),
    approver_reviewed_at: r.approver_reviewed_at instanceof Date ? (r.approver_reviewed_at as Date).toISOString() : (r.approver_reviewed_at ?? null),
    held_at: r.held_at instanceof Date ? (r.held_at as Date).toISOString() : (r.held_at ?? null),
    item_count: null,
    total_expected_cost: null,
  };
}

router.post("/requisitions/:id/submit", async (req, res) => {
  const id = Number(req.params.id);
  const { checker1_id, checker1_name, checker2_id, checker2_name, approver_id, approver_name } = req.body;
  if (!checker1_id || !checker1_name || !checker2_id || !checker2_name || !approver_id || !approver_name) {
    res.status(400).json({ error: "checker1, checker2, and approver are all required" });
    return;
  }
  if (checker1_id === checker2_id) {
    res.status(400).json({ error: "Checker 1 and Checker 2 must be different people" });
    return;
  }
  const [existing] = await db.select().from(requisitionsTable).where(eq(requisitionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (req.currentUser?.role !== "purchase_head" && existing.raised_by_id !== req.currentUser?.id) {
    res.status(403).json({ error: "Only the person who raised this requisition can submit it" });
    return;
  }
  const [updated] = await db.update(requisitionsTable)
    .set({
      status: "pending_checkers",
      checker1_id, checker1_name,
      checker2_id, checker2_name,
      approver_id, approver_name,
      submitted_at: new Date(), updated_at: new Date(),
    })
    .where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated as unknown as Record<string, unknown>));
});

router.post("/requisitions/:id/checker1-review", async (req, res) => {
  const id = Number(req.params.id);
  const { action, suggestion, checker_name } = req.body;
  if (!action) { res.status(400).json({ error: "action required" }); return; }

  const [existing] = await db.select().from(requisitionsTable).where(eq(requisitionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (req.currentUser?.role !== "purchase_head" && existing.checker1_id !== req.currentUser?.id) {
    res.status(403).json({ error: "You're not Checker 1 on this requisition" });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (checker_name) updates.checker1_name = checker_name;

  if (action === "hold") {
    // A hold pauses the whole requisition, not just this checker's own
    // decision — it doesn't touch checker1_status, so whatever the other
    // checker has (or hasn't) done is preserved for when this resumes.
    updates.status = "on_hold";
    updates.pre_hold_status = existing.status;
    updates.hold_reason = suggestion ?? null;
    updates.held_at = new Date();
  } else {
    updates.checker1_suggestion = suggestion ?? null;
    updates.checker1_reviewed_at = new Date();
    updates.checker1_status = action;
    if (action === "approved") {
      // Either checker can go first — only move on to the approver once BOTH have approved.
      updates.status = existing.checker2_status === "approved" ? "pending_approver" : "pending_checkers";
    } else {
      updates.status = "rejected";
    }
  }

  const [updated] = await db.update(requisitionsTable).set(updates).where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated as unknown as Record<string, unknown>));
});

router.post("/requisitions/:id/checker2-review", async (req, res) => {
  const id = Number(req.params.id);
  const { action, suggestion, checker_name } = req.body;
  if (!action) { res.status(400).json({ error: "action required" }); return; }

  const [existing] = await db.select().from(requisitionsTable).where(eq(requisitionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  if (req.currentUser?.role !== "purchase_head" && existing.checker2_id !== req.currentUser?.id) {
    res.status(403).json({ error: "You're not Checker 2 on this requisition" });
    return;
  }

  const updates: Record<string, unknown> = { updated_at: new Date() };
  if (checker_name) updates.checker2_name = checker_name;

  if (action === "hold") {
    updates.status = "on_hold";
    updates.pre_hold_status = existing.status;
    updates.hold_reason = suggestion ?? null;
    updates.held_at = new Date();
  } else {
    updates.checker2_suggestion = suggestion ?? null;
    updates.checker2_reviewed_at = new Date();
    updates.checker2_status = action;
    if (action === "approved") {
      updates.status = existing.checker1_status === "approved" ? "pending_approver" : "pending_checkers";
    } else {
      updates.status = "rejected";
    }
  }

  const [updated] = await db.update(requisitionsTable).set(updates).where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated as unknown as Record<string, unknown>));
});

async function requireApprover(req: import("express").Request, res: import("express").Response, id: number) {
  const [existing] = await db.select().from(requisitionsTable).where(eq(requisitionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return null; }
  if (req.currentUser?.role !== "purchase_head" && existing.approver_id !== req.currentUser?.id) {
    res.status(403).json({ error: "You're not the approver on this requisition" });
    return null;
  }
  return existing;
}

router.post("/requisitions/:id/approve", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await requireApprover(req, res, id);
  if (!existing) return;
  const { suggestion, approver_name } = req.body;
  const [updated] = await db.update(requisitionsTable)
    .set({
      status: "approved",
      approver_suggestion: suggestion ?? null,
      approver_reviewed_at: new Date(),
      approver_status: "approved",
      approver_name: approver_name ?? undefined,
      approved_at: new Date(),
      hold_reason: null,
      held_at: null,
      updated_at: new Date(),
    })
    .where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated as unknown as Record<string, unknown>));
});

router.post("/requisitions/:id/reject", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await requireApprover(req, res, id);
  if (!existing) return;
  const { suggestion, approver_name } = req.body;
  const [updated] = await db.update(requisitionsTable)
    .set({
      status: "rejected",
      approver_suggestion: suggestion ?? null,
      approver_reviewed_at: new Date(),
      approver_status: "rejected",
      approver_name: approver_name ?? undefined,
      hold_reason: null,
      held_at: null,
      updated_at: new Date(),
    })
    .where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated as unknown as Record<string, unknown>));
});

// Point 12: an alternative to approve/reject — pause the requisition
// without a final decision either way.
router.post("/requisitions/:id/hold", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await requireApprover(req, res, id);
  if (!existing) return;
  const { reason } = req.body;
  const [updated] = await db.update(requisitionsTable)
    .set({ status: "on_hold", pre_hold_status: existing.status, hold_reason: reason ?? null, held_at: new Date(), updated_at: new Date() })
    .where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated as unknown as Record<string, unknown>));
});

router.post("/requisitions/:id/resume", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(requisitionsTable).where(eq(requisitionsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  // Either checker or the approver can resume — whoever holds it, anyone
  // still active on the review chain can bring it back.
  const isParty = req.currentUser?.role === "purchase_head"
    || existing.checker1_id === req.currentUser?.id
    || existing.checker2_id === req.currentUser?.id
    || existing.approver_id === req.currentUser?.id;
  if (!isParty) {
    res.status(403).json({ error: "You're not part of this requisition's review" });
    return;
  }
  const [updated] = await db.update(requisitionsTable)
    .set({ status: existing.pre_hold_status ?? "pending_approver", pre_hold_status: null, hold_reason: null, held_at: null, updated_at: new Date() })
    .where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated as unknown as Record<string, unknown>));
});

router.post("/requisitions/:id/assign", async (req, res) => {
  const id = Number(req.params.id);
  if (req.currentUser?.role !== "purchase_head") {
    res.status(403).json({ error: "Only Purchase Head can assign a requisition" });
    return;
  }
  const { assigned_to_id, assigned_to_name } = req.body;
  if (!assigned_to_id || !assigned_to_name) { res.status(400).json({ error: "assigned_to_id and assigned_to_name required" }); return; }
  const [updated] = await db.update(requisitionsTable)
    .set({
      assigned_to_id, assigned_to_name, assigned_at: new Date(), status: "in_progress", updated_at: new Date(),
      purchase_head_id: req.currentUser?.id ?? null,
      purchase_head_name: req.currentUser?.name ?? null,
    })
    .where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated as unknown as Record<string, unknown>));
});

// ── Approval notes (point 2) ────────────────────────────────────────────────
router.get("/requisitions/:id/approval-notes", async (req, res) => {
  const id = Number(req.params.id);
  const lineageIds = await getRelationLineage(id);
  const rows = await db.select().from(approvalNotesTable).where(inArray(approvalNotesTable.requisition_id, lineageIds)).orderBy(approvalNotesTable.created_at);
  res.json(rows.map(r => ({ ...r, inherited: r.requisition_id !== id, created_at: r.created_at.toISOString() })));
});

router.post("/requisitions/:id/approval-notes", async (req, res) => {
  const id = Number(req.params.id);
  if (req.currentUser?.role !== "purchase_head") {
    res.status(403).json({ error: "Only Purchase Head can add an approval note" });
    return;
  }
  const { note_number } = req.body;
  if (!note_number) { res.status(400).json({ error: "note_number is required" }); return; }
  const [row] = await db.insert(approvalNotesTable).values({
    requisition_id: id,
    note_number,
    created_by_name: req.currentUser.name,
  }).returning();
    await db.insert(statusUpdatesTable).values({
    requisition_id: id,
    updated_by_name: req.currentUser.name,
    stage: "prepared",
    notes: `Approval Note: ${note_number}`,
    update_date: todayIST(),
  });
  res.status(201).json({ ...row, created_at: row.created_at.toISOString() });
});

router.post("/requisitions/:id/partial-close", async (req, res) => {
  const id = Number(req.params.id);
  const fulfilledItemIds = req.body?.fulfilled_item_ids;
  const closureNote = typeof req.body?.closure_note === "string" ? req.body.closure_note.trim() : "";

  if (req.currentUser?.role !== "purchase_head") {
    res.status(403).json({ error: "Only Purchase Head can partially close a requisition" });
    return;
  }
  if (!Number.isInteger(id) || id <= 0 || !Array.isArray(fulfilledItemIds) || fulfilledItemIds.length === 0 || fulfilledItemIds.some((itemId: unknown) => !Number.isInteger(itemId))) {
    res.status(400).json({ error: "fulfilled_item_ids must contain at least one integer item ID" });
    return;
  }
  if (!closureNote) {
    res.status(400).json({ error: "An approval/closure note is required to partially close this requisition" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(requisitionsTable)
        .where(eq(requisitionsTable.id, id))
        .for("update");
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.status === "completed") throw new Error("ALREADY_COMPLETED");
      if (existing.status !== "in_progress") throw new Error("INVALID_STATUS");

      const parentItems = await tx
        .select()
        .from(requisitionItemsTable)
        .where(eq(requisitionItemsTable.requisition_id, id));
      const selectedIds = new Set(fulfilledItemIds as number[]);
      const fulfilledItems = parentItems.filter(item => selectedIds.has(item.id));
      const remainingItems = parentItems.filter(item => !selectedIds.has(item.id));

      if (fulfilledItems.length !== selectedIds.size) throw new Error("INVALID_ITEMS");
      if (fulfilledItems.length === 0 || remainingItems.length === 0) throw new Error("INVALID_SPLIT");

      const [previousRelation] = await tx
        .select({ root_requisition_id: requisitionPartialRelationsTable.root_requisition_id })
        .from(requisitionPartialRelationsTable)
        .where(eq(requisitionPartialRelationsTable.child_requisition_id, id))
        .limit(1);
      const rootId = previousRelation?.root_requisition_id ?? id;
      const [root] = await tx
        .select({ id: requisitionsTable.id, ref_number: requisitionsTable.ref_number })
        .from(requisitionsTable)
        .where(eq(requisitionsTable.id, rootId))
        .for("update");
      if (!root) throw new Error("NOT_FOUND");

      const [sequenceRow] = await tx
        .select({ value: max(requisitionPartialRelationsTable.continuation_number) })
        .from(requisitionPartialRelationsTable)
        .where(eq(requisitionPartialRelationsTable.root_requisition_id, rootId));
      const continuationNumber = Number(sequenceRow?.value ?? 0) + 1;
      const childRefNumber = `${root.ref_number}.${continuationNumber}`;

      const [child] = await tx.insert(requisitionsTable).values({
        ref_number: childRefNumber,
        company_id: existing.company_id,
        project_id: existing.project_id,
        site_id: existing.site_id,
        raised_by_id: existing.raised_by_id,
        raised_by_name: existing.raised_by_name,
        site_name: existing.site_name,
        requisition_date: existing.requisition_date,
        priority: existing.priority,
        purpose: existing.purpose,
        notes: existing.notes,
        status: existing.status,
        checker1_id: existing.checker1_id,
        checker1_name: existing.checker1_name,
        checker1_suggestion: existing.checker1_suggestion,
        checker1_reviewed_at: existing.checker1_reviewed_at,
        checker1_status: existing.checker1_status,
        checker2_id: existing.checker2_id,
        checker2_name: existing.checker2_name,
        checker2_suggestion: existing.checker2_suggestion,
        checker2_reviewed_at: existing.checker2_reviewed_at,
        checker2_status: existing.checker2_status,
        approver_id: existing.approver_id,
        approver_name: existing.approver_name,
        approver_suggestion: existing.approver_suggestion,
        approver_reviewed_at: existing.approver_reviewed_at,
        approver_status: existing.approver_status,
        purchase_head_id: existing.purchase_head_id,
        purchase_head_name: existing.purchase_head_name,
        assigned_to_id: existing.assigned_to_id,
        assigned_to_name: existing.assigned_to_name,
        assigned_at: existing.assigned_at,
        submitted_at: existing.submitted_at,
        approved_at: existing.approved_at,
        created_at: existing.created_at,
        updated_at: new Date(),
      }).returning();

      const childItems = await tx.insert(requisitionItemsTable).values(
        remainingItems.map(item => ({
          requisition_id: child.id,
          item_name: item.item_name,
          quantity: item.quantity,
          unit: item.unit,
          reference_no: item.reference_no,
          expected_cost: item.expected_cost,
          expected_cost_is_unit: item.expected_cost_is_unit,
          description: item.description,
          remark: item.remark,
          asset_id: item.asset_id,
          asset_name: item.asset_name,
          sort_order: item.sort_order,
        })),
      ).returning();

      const [relation] = await tx.insert(requisitionPartialRelationsTable).values({
        root_requisition_id: rootId,
        parent_requisition_id: id,
        child_requisition_id: child.id,
        continuation_number: continuationNumber,
        relation_type: "partial",
        created_by: req.currentUser!.id,
      }).returning();

      await tx.insert(requisitionPartialRelationItemsTable).values(
        remainingItems.map((item, index) => ({
          relation_id: relation.id,
          parent_item_id: item.id,
          child_item_id: childItems[index].id,
        })),
      );

      const now = new Date();
      await tx.update(requisitionsTable)
        .set({ status: "completed", completed_at: now, updated_at: now })
        .where(eq(requisitionsTable.id, id));
      await tx.insert(approvalNotesTable).values({
        requisition_id: id,
        note_number: closureNote,
        created_by_name: req.currentUser!.name,
      });
      await tx.insert(statusUpdatesTable).values({
        requisition_id: id,
        updated_by_name: req.currentUser!.name,
        stage: "prepared",
        notes: `Partially closed by Purchase Head. Approval/closure note: ${closureNote}. Remaining items moved to ${childRefNumber}.`,
        update_date: todayIST(),
      });

      return { child, relation };
    });

    res.status(201).json({ ...fmt(result.child as unknown as Record<string, unknown>), continuation: result.relation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "NOT_FOUND") { res.status(404).json({ error: "Requisition not found" }); return; }
    if (message === "ALREADY_COMPLETED") { res.status(409).json({ error: "This requisition is already completed" }); return; }
    if (message === "INVALID_STATUS") { res.status(400).json({ error: "Only an in-progress requisition can be partially closed" }); return; }
    if (message === "INVALID_ITEMS") { res.status(400).json({ error: "Selected items must belong to this requisition" }); return; }
    if (message === "INVALID_SPLIT") { res.status(400).json({ error: "Select fulfilled items and leave at least one remaining item" }); return; }
    res.status(500).json({ error: "Failed to partially close requisition" });
  }
});

router.delete("/requisitions/:id/approval-notes/:noteId", async (req, res) => {
  if (req.currentUser?.role !== "purchase_head") {
    res.status(403).json({ error: "Only Purchase Head can remove an approval note" });
    return;
  }
  await db.delete(approvalNotesTable).where(eq(approvalNotesTable.id, Number(req.params.noteId)));
  res.status(204).send();
});

// Point 2: closing a requisition ("progress end") is Purchase-Head-only,
// and requires at least one approval note already linked.
router.post("/requisitions/:id/complete", async (req, res) => {
  const id = Number(req.params.id);
  if (req.currentUser?.role !== "purchase_head") {
    res.status(403).json({ error: "Only Purchase Head can close a requisition" });
    return;
  }
  const notes = await db.select().from(approvalNotesTable).where(eq(approvalNotesTable.requisition_id, id));
  if (notes.length === 0) {
    res.status(400).json({ error: "Add at least one approval note number before closing this requisition" });
    return;
  }
  const [updated] = await db.update(requisitionsTable)
    .set({ status: "completed", completed_at: new Date(), updated_at: new Date() })
    .where(eq(requisitionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(fmt(updated as unknown as Record<string, unknown>));
});

export default router;
