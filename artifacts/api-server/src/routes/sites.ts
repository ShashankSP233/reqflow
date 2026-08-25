import { Router } from "express";
import { db } from "@workspace/db";
import { sitesTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

router.post("/sites", async (req, res) => {
  const { name, location, company_id } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(sitesTable).values({ name, location: location ?? null, company_id: company_id ?? null }).returning();
  const company = row.company_id ? await db.select().from(companiesTable).where(eq(companiesTable.id, row.company_id)).limit(1) : [];
  res.status(201).json({ ...row, company_name: company[0]?.name ?? null });
});

export default router;
