import { pgTable, serial, text, integer, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { requisitionsTable } from "./requisitions";
import { requisitionItemsTable } from "./requisition_items";
import { usersTable } from "./users";

export const requisitionPartialRelationsTable = pgTable(
  "requisition_partial_relations",
  {
    id: serial("id").primaryKey(),
    root_requisition_id: integer("root_requisition_id").notNull().references(() => requisitionsTable.id, { onDelete: "cascade" }),
    parent_requisition_id: integer("parent_requisition_id").notNull().references(() => requisitionsTable.id, { onDelete: "cascade" }),
    child_requisition_id: integer("child_requisition_id").notNull().references(() => requisitionsTable.id, { onDelete: "cascade" }),
    continuation_number: integer("continuation_number").notNull(),
    relation_type: text("relation_type").notNull().default("partial"),
    created_by: integer("created_by").references(() => usersTable.id),
    created_at: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    childUnique: uniqueIndex("requisition_partial_relations_child_unique").on(table.child_requisition_id),
    rootSequenceUnique: uniqueIndex("requisition_partial_relations_root_sequence_unique").on(table.root_requisition_id, table.continuation_number),
    parentIndex: index("requisition_partial_relations_parent_idx").on(table.parent_requisition_id),
    rootIndex: index("requisition_partial_relations_root_idx").on(table.root_requisition_id),
  }),
);

export const requisitionPartialRelationItemsTable = pgTable(
  "requisition_partial_relation_items",
  {
    id: serial("id").primaryKey(),
    relation_id: integer("relation_id").notNull().references(() => requisitionPartialRelationsTable.id, { onDelete: "cascade" }),
    parent_item_id: integer("parent_item_id").notNull().references(() => requisitionItemsTable.id, { onDelete: "cascade" }),
    child_item_id: integer("child_item_id").notNull().references(() => requisitionItemsTable.id, { onDelete: "cascade" }),
  },
  (table) => ({
    childItemUnique: uniqueIndex("requisition_partial_relation_items_child_unique").on(table.child_item_id),
    parentItemUnique: uniqueIndex("requisition_partial_relation_items_parent_unique").on(table.parent_item_id),
    relationIndex: index("requisition_partial_relation_items_relation_idx").on(table.relation_id),
  }),
);

export type RequisitionPartialRelation = typeof requisitionPartialRelationsTable.$inferSelect;
export type RequisitionPartialRelationItem = typeof requisitionPartialRelationItemsTable.$inferSelect;