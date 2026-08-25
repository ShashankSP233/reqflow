import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "@workspace/db";
import { attachmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|xlsx|xls|csv|doc|docx/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error("Only images, PDF, Excel and Word files are allowed"));
  },
});

const router = Router();

router.post("/upload/:requisitionId", upload.single("file"), async (req, res) => {
  const requisitionId = Number(req.params.requisitionId);
  const { context = "requisition", context_id, uploaded_by } = req.query;

  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const [att] = await db.insert(attachmentsTable).values({
    requisition_id: requisitionId,
    context: String(context),
    context_id: context_id ? Number(context_id) : null,
    filename: req.file.filename,
    original_name: req.file.originalname,
    mime_type: req.file.mimetype,
    size_bytes: req.file.size,
    uploaded_by_name: uploaded_by ? String(uploaded_by) : null,
  }).returning();

  const baseUrl = process.env.BASE_URL ?? "/api";
  res.status(201).json({ ...att, uploaded_at: att.uploaded_at.toISOString(), url: `${baseUrl}/files/${att.filename}` });
});

router.delete("/attachments/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [att] = await db.select().from(attachmentsTable).where(eq(attachmentsTable.id, id)).limit(1);
  if (att) {
    const filePath = path.join(UPLOADS_DIR, att.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.delete(attachmentsTable).where(eq(attachmentsTable.id, id));
  }
  res.status(204).send();
});

// Serve uploaded files
router.get("/files/:filename", (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found" }); return; }
  res.sendFile(filePath);
});

export default router;
