import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const companiesTable = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
});

export type Company = typeof companiesTable.$inferSelect;
