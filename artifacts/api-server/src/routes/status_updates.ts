import { Router } from "express";
import { db } from "@workspace/db";
import { statusUpdatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { todayIST } from "../lib/business-days";

const router = Router();

router.get("/requisitions/:id/status-updates", async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db.select().from(statusUpdatesTable).where(eq(statusUpdatesTable.requisition_id, id)).orderBy(statusUpdatesTable.created_at);
  res.json(rows.map(r => ({ ...r, created_at: r.created_at.toISOString() })));
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
