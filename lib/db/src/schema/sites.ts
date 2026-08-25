import { pgTable, serial, text, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const sitesTable = pgTable("sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company_id: integer("company_id").references(() => companiesTable.id),
  location: text("location"),
});

export type Site = typeof sitesTable.$inferSelect;
