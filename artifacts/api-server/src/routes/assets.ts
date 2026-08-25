import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable } from "@workspace/db";
import { eq, or, isNull } from "drizzle-orm";

const router = Router();

router.get("/assets", async (req, res) => {
  const { project_id } = req.query;
  let query = db.select().from(assetsTable).$dynamic();
  if (project_id) {
    // Assets tied to this project, plus assets with no project (available everywhere).
    query = query.where(or(eq(assetsTable.project_id, Number(project_id)), isNull(assetsTable.project_id)));
  }
  const rows = await query.orderBy(assetsTable.name);
  res.json(rows);
});

router.post("/assets", async (req, res) => {
  const { name, type, project_id } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(assetsTable).values({ name, type: type ?? null, project_id: project_id ?? null }).returning();
  res.status(201).json(row);
});

router.patch("/assets/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, type, project_id } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (project_id !== undefined) updates.project_id = project_id;
  const [row] = await db.update(assetsTable).set(updates).where(eq(assetsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/assets/:id", async (req, res) => {
  await db.delete(assetsTable).where(eq(assetsTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
