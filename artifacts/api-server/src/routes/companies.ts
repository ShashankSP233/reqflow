import { Router } from "express";
import { db } from "@workspace/db";
import { companiesTable } from "@workspace/db";

const router = Router();

router.get("/companies", async (_req, res) => {
  const rows = await db.select().from(companiesTable).orderBy(companiesTable.name);
  res.json(rows);
});

router.post("/companies", async (req, res) => {
  const { name, address } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(companiesTable).values({ name, address: address ?? null }).returning();
  res.status(201).json(row);
});

export default router;
