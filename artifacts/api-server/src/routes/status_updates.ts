import { Router } from "express";
import { db } from "@workspace/db";
import { statusUpdatesTable, requisitionPartialRelationsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { todayIST } from "../lib/business-days";

const router = Router();

async function getRelationLineage(id: number) {
  const lineage = [id];
  let currentId = id;
  while (true) {
    const [relation] = await db.select({ parent_requisition_id: requisitionPartialRelationsTable.parent_requisition_id })
      .from(requisitionPartialRelationsTable)
      .where(eq(requisitionPartialRelationsTable.child_requisition_id, currentId)).limit(1);
    if (!relation) break;
    lineage.push(relation.parent_requisition_id);
    currentId = relation.parent_requisition_id;
  }
  return lineage.reverse();
}

router.get("/requisitions/:id/status-updates", async (req, res) => {
  const id = Number(req.params.id);
  const lineageIds = await getRelationLineage(id);
  const rows = await db.select().from(statusUpdatesTable).where(inArray(statusUpdatesTable.requisition_id, lineageIds)).orderBy(statusUpdatesTable.created_at);
  res.json(rows.map(r => ({ ...r, inherited: r.requisition_id !== id, created_at: r.created_at.toISOString() })));
});

router.post("/requisitions/:id/status-updates", async (req, res) => {
  const id = Number(req.params.id);
  const { stage, notes } = req.body;

  if (req.currentUser?.role !== "purchase_member") {
    res.status(403).json({
      error: "Only purchase members can add status updates",
    });
    return;
  }

  if (!stage) {
    res.status(400).json({
      error: "stage required",
    });
    return;
  }

  const [row] = await db
    .insert(statusUpdatesTable)
    .values({
      requisition_id: id,
      updated_by_name: req.currentUser.name,
      stage,
      notes: notes ?? null,
      update_date: todayIST(),
    })
    .returning();

  res.status(201).json({
    ...row,
    created_at: row.created_at.toISOString(),
  });
});

export default router;
