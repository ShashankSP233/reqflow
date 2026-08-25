import { Router } from "express";
import { db } from "@workspace/db";
import { queriesTable, queryRepliesTable, attachmentsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const router = Router();

router.get("/requisitions/:id/queries", async (req, res) => {
  const reqId = Number(req.params.id);
  const queries = await db.select().from(queriesTable).where(eq(queriesTable.requisition_id, reqId)).orderBy(queriesTable.created_at);
  const queryIds = queries.map(q => q.id);
  const replies = queryIds.length > 0 ? await db.select().from(queryRepliesTable).where(inArray(queryRepliesTable.query_id, queryIds)) : [];
  const replyIds = replies.map(r => r.id);
  const baseUrl = process.env.BASE_URL ?? "/api";
  const atts = replyIds.length > 0 ? await db.select().from(attachmentsTable).where(inArray(attachmentsTable.context_id, replyIds)) : [];
  const fmtAtt = (a: typeof atts[0]) => ({ ...a, uploaded_at: a.uploaded_at.toISOString(), url: `${baseUrl}/files/${a.filename}` });

  res.json(queries.map(q => ({
    ...q,
    created_at: q.created_at.toISOString(),
    resolved_at: q.resolved_at?.toISOString() ?? null,
    replies: replies.filter(r => r.query_id === q.id).map(r => ({
      ...r, created_at: r.created_at.toISOString(),
      attachments: atts.filter(a => a.context_id === r.id).map(fmtAtt),
    })),
    attachments: [],
  })));
});

router.post("/requisitions/:id/queries", async (req, res) => {
  const reqId = Number(req.params.id);
  const { raised_by_name, raised_by_role, message } = req.body;
  if (!raised_by_name || !message) { res.status(400).json({ error: "raised_by_name and message required" }); return; }
  const [q] = await db.insert(queriesTable).values({ requisition_id: reqId, raised_by_name, raised_by_role: raised_by_role ?? null, message }).returning();
  res.status(201).json({ ...q, created_at: q.created_at.toISOString(), resolved_at: null, replies: [], attachments: [] });
});

router.post("/queries/:queryId/reply", async (req, res) => {
  const queryId = Number(req.params.queryId);
  const { replied_by_name, replied_by_role, message } = req.body;
  if (!replied_by_name || !message) { res.status(400).json({ error: "replied_by_name and message required" }); return; }
  const [r] = await db.insert(queryRepliesTable).values({ query_id: queryId, replied_by_name, replied_by_role: replied_by_role ?? null, message }).returning();
  res.status(201).json({ ...r, created_at: r.created_at.toISOString(), attachments: [] });
});

router.post("/queries/:queryId/resolve", async (req, res) => {
  const queryId = Number(req.params.queryId);
  const { resolved_by_name } = req.body;
  const [q] = await db.update(queriesTable)
    .set({ is_resolved: true, resolved_by_name: resolved_by_name ?? null, resolved_at: new Date() })
    .where(eq(queriesTable.id, queryId)).returning();
  if (!q) { res.status(404).json({ error: "Not found" }); return; }
  const replies = await db.select().from(queryRepliesTable).where(eq(queryRepliesTable.query_id, queryId));
  res.json({ ...q, created_at: q.created_at.toISOString(), resolved_at: q.resolved_at?.toISOString() ?? null, replies: replies.map(r => ({ ...r, created_at: r.created_at.toISOString(), attachments: [] })), attachments: [] });
});

export default router;
