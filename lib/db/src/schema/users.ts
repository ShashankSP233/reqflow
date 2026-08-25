import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // also doubles as the login identifier
  email: text("email"),
  role: text("role").notNull(), // site_user | checker | approver | purchase_head | purchase_member
  site_name: text("site_name"),
  password_hash: text("password_hash"), // null = this person has no login yet (e.g. a director who's reference-only)
});

export type User = typeof usersTable.$inferSelect;
