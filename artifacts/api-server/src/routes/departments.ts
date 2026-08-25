import { Router } from "express";
import { db } from "@workspace/db";
import { departmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/departments", async (req, res) => {
  const departments = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
  res.json(departments);
});

router.post("/departments", async (req, res) => {
  const { name, code, budget_limit } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [dept] = await db.insert(departmentsTable).values({
    name,
    code: code ?? null,
    budget_limit: budget_limit != null ? String(budget_limit) : null,
  }).returning();
  res.status(201).json(dept);
});

export default router;
