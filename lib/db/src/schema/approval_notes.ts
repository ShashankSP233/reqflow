import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { requisitionsTable } from "./requisitions";

export const approvalNotesTable = pgTable("approval_notes", {
  id: serial("id").primaryKey(),
  requisition_id: integer("requisition_id").notNull().references(() => requisitionsTable.id, { onDelete: "cascade" }),
  note_number: text("note_number").notNull(),
  created_by_name: text("created_by_name"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type ApprovalNote = typeof approvalNotesTable.$inferSelect;
