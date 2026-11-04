import { pgTable, serial, text, integer, timestamp, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { requisitionsTable } from "./requisitions";
import { usersTable } from "./users";

// Append-only history: the most recent event determines whether the tag is
// currently active. Keeping both actions makes tag changes auditable/reversible.
export const localPurchaseTagEventsTable = pgTable("local_purchase_tag_events", {
  id: serial("id").primaryKey(),
  requisition_id: integer("requisition_id").notNull().references(() => requisitionsTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // tagged | untagged
  changed_by_id: integer("changed_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  changed_by_name: text("changed_by_name").notNull(),
  changed_at: timestamp("changed_at").notNull().defaultNow(),
}, (table) => [
  check("local_purchase_tag_events_action_check", sql`${table.action} IN ('tagged', 'untagged')`),
  index("local_purchase_tag_events_requisition_id_idx").on(table.requisition_id),
]);

export type LocalPurchaseTagEvent = typeof localPurchaseTagEventsTable.$inferSelect;
