import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { requisitionsTable } from "./requisitions";

export const statusUpdatesTable = pgTable("status_updates", {
  id: serial("id").primaryKey(),
  requisition_id: integer("requisition_id").notNull().references(() => requisitionsTable.id, { onDelete: "cascade" }),
  updated_by_name: text("updated_by_name").notNull(),
  stage: text("stage").notNull(), // prepared | checked | accounts_reviewed | reviewed_person1 | reviewed_person2 | reviewed_person3 | reviewed_md | reviewed_chairman
  notes: text("notes"),
  update_date: text("update_date").notNull(), // YYYY-MM-DD
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type StatusUpdate = typeof statusUpdatesTable.$inferSelect;
