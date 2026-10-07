import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, companiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requirePurchaseHead } from "../middlewares/require-auth";

const router = Router();

router.get("/projects", async (_req, res) => {
  const rows = await db
    .select({
      id: projectsTable.id,
      name: projectsTable.name,
      code: projectsTable.code,
      company_id: projectsTable.company_id,
      company_name: companiesTable.name,
    })
    .from(projectsTable)
    .leftJoin(companiesTable, eq(projectsTable.company_id, companiesTable.id))
    .orderBy(projectsTable.name);
  res.json(rows);
});

router.post("/projects", requirePurchaseHead, async (req, res) => {
  const { name, code, company_id } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.insert(projectsTable).values({ name, code: code ?? null, company_id: company_id ?? null }).returning();
  const company = row.company_id ? await db.select().from(companiesTable).where(eq(companiesTable.id, row.company_id)).limit(1) : [];
  res.status(201).json({ ...row, company_name: company[0]?.name ?? null });
});

router.patch("/projects/:id", requirePurchaseHead, async (req, res) => {
  const id = Number(req.params.id);
  const { name, code } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [row] = await db.update(projectsTable).set({ name, code: code || null }).where(eq(projectsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const company = row.company_id ? await db.select().from(companiesTable).where(eq(companiesTable.id, row.company_id)).limit(1) : [];
  res.json({ ...row, company_name: company[0]?.name ?? null });
});

export default router;
