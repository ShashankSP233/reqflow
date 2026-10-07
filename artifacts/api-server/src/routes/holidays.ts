import { Router } from "express";
import { db } from "@workspace/db";
import { holidaysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePurchaseHead } from "../middlewares/require-auth";

const router = Router();

router.get("/holidays", async (_req, res) => {
  const rows = await db.select().from(holidaysTable).orderBy(holidaysTable.date);
  res.json(rows);
});

router.post("/holidays", requirePurchaseHead, async (req, res) => {
  const { date, name } = req.body;
  if (!date || !name) { res.status(400).json({ error: "date and name are required" }); return; }
  try {
    const [row] = await db.insert(holidaysTable).values({ date, name }).returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A holiday is already set for that date" });
      return;
    }
    throw err;
  }
});

router.patch("/holidays/:id", requirePurchaseHead, async (req, res) => {
  const id = Number(req.params.id);
  const { date, name } = req.body;
  if (!date || !name) { res.status(400).json({ error: "date and name are required" }); return; }
  try {
    const [row] = await db.update(holidaysTable).set({ date, name }).where(eq(holidaysTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A holiday is already set for that date" });
      return;
    }
    throw err;
  }
});

router.delete("/holidays/:id", requirePurchaseHead, async (req, res) => {
  await db.delete(holidaysTable).where(eq(holidaysTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
