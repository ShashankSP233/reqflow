import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const holidaysTable = pgTable("holidays", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().unique(), // YYYY-MM-DD
  name: text("name").notNull(),
});

export type Holiday = typeof holidaysTable.$inferSelect;
