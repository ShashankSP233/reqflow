import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type"), // vessel | equipment | location (a label, not strictly enforced)
  project_id: integer("project_id").references(() => projectsTable.id), // null = available on every project
});

export type Asset = typeof assetsTable.$inferSelect;
