import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { requisitionsTable } from "./requisitions";

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  requisition_id: integer("requisition_id").notNull().references(() => requisitionsTable.id, { onDelete: "cascade" }),
  context: text("context").notNull().default("requisition"), // requisition | query_reply
  context_id: integer("context_id"), // query reply id if context = query_reply
  filename: text("filename").notNull(),
  original_name: text("original_name").notNull(),
  mime_type: text("mime_type"),
  size_bytes: integer("size_bytes"),
  uploaded_by_name: text("uploaded_by_name"),
  uploaded_at: timestamp("uploaded_at").notNull().defaultNow(),
});

export type Attachment = typeof attachmentsTable.$inferSelect;
