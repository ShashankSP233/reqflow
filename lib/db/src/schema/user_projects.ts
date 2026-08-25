import { pgTable, serial, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { projectsTable } from "./projects";

export const userProjectsTable = pgTable("user_projects", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  project_id: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
}, (t) => [unique().on(t.user_id, t.project_id)]);

export type UserProject = typeof userProjectsTable.$inferSelect;
