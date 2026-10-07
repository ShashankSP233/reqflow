import { Router } from "express";
import { db } from "@workspace/db";
import { sitesTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePurchaseHead } from "../middlewares/require-auth";

const router = Router();

router.get("/sites", async (_req, res) => {
  const rows = await db
    .select({
      id: sitesTable.id,
      name: sitesTable.name,
      location: sitesTable.location,
      company_id: sitesTable.company_id,
      company_name: companiesTable.name,
    })
    .from(sitesTable)
    .leftJoin(companiesTable, eq(sitesTable.company_id, companiesTable.id))
    .orderBy(sitesTable.name);
  res.json(rows);
});

router.post("/sites", requirePurchaseHead, async (req, res) => {
  const { name, location, company_id } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(sitesTable).values({ name, location: location ?? null, company_id: company_id ?? null }).returning();
  const company = row.company_id ? await db.select().from(companiesTable).where(eq(companiesTable.id, row.company_id)).limit(1) : [];
  res.status(201).json({ ...row, company_name: company[0]?.name ?? null });
});

router.patch("/sites/:id", requirePurchaseHead, async (req, res) => {
  const id = Number(req.params.id);
  const { name, location } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.update(sitesTable).set({ name, location: location || null }).where(eq(sitesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const company = row.company_id ? await db.select().from(companiesTable).where(eq(companiesTable.id, row.company_id)).limit(1) : [];
  res.json({ ...row, company_name: company[0]?.name ?? null });
});

export default router;
