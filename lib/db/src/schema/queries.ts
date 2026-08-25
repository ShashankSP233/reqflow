import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { requisitionsTable } from "./requisitions";

export const queriesTable = pgTable("queries", {
  id: serial("id").primaryKey(),
  requisition_id: integer("requisition_id").notNull().references(() => requisitionsTable.id, { onDelete: "cascade" }),
  raised_by_name: text("raised_by_name").notNull(),
  raised_by_role: text("raised_by_role"),
  message: text("message").notNull(),
  is_resolved: boolean("is_resolved").notNull().default(false),
  resolved_by_name: text("resolved_by_name"),
  resolved_at: timestamp("resolved_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const queryRepliesTable = pgTable("query_replies", {
  id: serial("id").primaryKey(),
  query_id: integer("query_id").notNull().references(() => queriesTable.id, { onDelete: "cascade" }),
  replied_by_name: text("replied_by_name").notNull(),
  replied_by_role: text("replied_by_role"),
  message: text("message").notNull(),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export type Query = typeof queriesTable.$inferSelect;
export type QueryReply = typeof queryRepliesTable.$inferSelect;
