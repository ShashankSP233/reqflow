import { pgTable, serial, text, integer, numeric } from "drizzle-orm/pg-core";
import { requisitionsTable } from "./requisitions";
import { assetsTable } from "./assets";

export const requisitionItemsTable = pgTable("requisition_items", {
  id: serial("id").primaryKey(),
  requisition_id: integer("requisition_id").notNull().references(() => requisitionsTable.id, { onDelete: "cascade" }),
  item_name: text("item_name").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 3 }).notNull(),
  unit: text("unit"),
  reference_no: text("reference_no"),
  expected_cost: numeric("expected_cost", { precision: 12, scale: 2 }),
  description: text("description"),
  remark: text("remark"),
  asset_id: integer("asset_id").references(() => assetsTable.id),
  asset_name: text("asset_name"),
  sort_order: integer("sort_order").notNull().default(0),
});

export type RequisitionItem = typeof requisitionItemsTable.$inferSelect;
