import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, userProjectsTable } from "@workspace/db";
import { eq, inArray, sql, and } from "drizzle-orm";

const router = Router();

import { hashPassword } from "../lib/auth";

function toSafeUser(row: typeof usersTable.$inferSelect) {
  const { password_hash, ...rest } = row;
  return { ...rest, has_password: password_hash != null };
}

async function syncUserProjects(userId: number, projectIds: number[] | undefined) {
  if (projectIds === undefined) return; // not provided in this request — leave assignments unchanged
  await db.delete(userProjectsTable).where(eq(userProjectsTable.user_id, userId));
  if (projectIds.length > 0) {
    await db.insert(userProjectsTable).values(projectIds.map((project_id) => ({ user_id: userId, project_id })));
  }
}

router.get("/users", async (req, res) => {
  const { role, project_id } = req.query;
  const conditions = [];
  if (role) conditions.push(eq(usersTable.role, String(role)));
  if (project_id) {
    const assigned = await db.select({ user_id: userProjectsTable.user_id }).from(userProjectsTable).where(eq(userProjectsTable.project_id, Number(project_id)));
    const ids = assigned.map(a => a.user_id);
    conditions.push(ids.length > 0 ? inArray(usersTable.id, ids) : sql`false`);
  }
  let query = db.select().from(usersTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  const rows = await query.orderBy(usersTable.name);

  const allAssignments = await db.select().from(userProjectsTable);
  const projectsByUser = new Map<number, number[]>();
  for (const a of allAssignments) {
    if (!projectsByUser.has(a.user_id)) projectsByUser.set(a.user_id, []);
    projectsByUser.get(a.user_id)!.push(a.project_id);
  }

  res.json(rows.map(r => ({ ...toSafeUser(r), project_ids: projectsByUser.get(r.id) ?? [] })));
});

router.post("/users", async (req, res) => {
  const { name, email, role, site_name, password, project_ids } = req.body;
  if (!name || !role) { res.status(400).json({ error: "name and role required" }); return; }
  try {
    const [row] = await db.insert(usersTable).values({
      name,
      email: email ?? null,
      role,
      site_name: site_name ?? null,
      password_hash: password ? hashPassword(password) : null,
    }).returning();
    await syncUserProjects(row.id, project_ids);
    res.status(201).json({ ...toSafeUser(row), project_ids: project_ids ?? [] });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A user with that name already exists" });
      return;
    }
    throw err;
  }
});

router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, role, site_name, password, project_ids } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (role !== undefined) updates.role = role;
  if (site_name !== undefined) updates.site_name = site_name;
  if (password) updates.password_hash = hashPassword(password);
  try {
    const [row] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    await syncUserProjects(id, project_ids);
    const assigned = await db.select().from(userProjectsTable).where(eq(userProjectsTable.user_id, id));
    res.json({ ...toSafeUser(row), project_ids: assigned.map(a => a.project_id) });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A user with that name already exists" });
      return;
    }
    throw err;
  }
});

router.delete("/users/:id", async (req, res) => {
  await db.delete(usersTable).where(eq(usersTable.id, Number(req.params.id)));
  res.status(204).send();
});

export default router;
