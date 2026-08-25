import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  company_id: integer("company_id").references(() => companiesTable.id),
});

export type Project = typeof projectsTable.$inferSelect;
