import { Router } from "express";
import { db } from "@workspace/db";
import { holidaysTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/holidays", async (_req, res) => {
  const rows = await db.select().from(holidaysTable).orderBy(holidaysTable.date);
  res.json(rows);
});

router.post("/holidays", async (req, res) => {
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

router.delete("/holidays/:id", async (req, res) => {
  await db.delete(holidaysTable).where(eq(holidaysTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
