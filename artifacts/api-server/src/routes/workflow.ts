import { Router } from "express";
import { db } from "@workspace/db";
import { requisitionsTable, approvalNotesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { todayIST } from "../lib/business-days";

const router = Router();

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
  const rows = await db.select().from(approvalNotesTable).where(eq(approvalNotesTable.requisition_id, id)).orderBy(approvalNotesTable.created_at);
  res.json(rows.map(r => ({ ...r, created_at: r.created_at.toISOString() })));
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
  res.status(201).json({ ...row, created_at: row.created_at.toISOString() });
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
