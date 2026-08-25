import { pgTable, serial, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { projectsTable } from "./projects";
import { sitesTable } from "./sites";
import { usersTable } from "./users";

export const requisitionsTable = pgTable("requisitions", {
  id: serial("id").primaryKey(),
  ref_number: text("ref_number").notNull(),
  company_id: integer("company_id").references(() => companiesTable.id),
  project_id: integer("project_id").references(() => projectsTable.id),
  site_id: integer("site_id").references(() => sitesTable.id),
  raised_by_id: integer("raised_by_id").references(() => usersTable.id),
  raised_by_name: text("raised_by_name").notNull(),
  site_name: text("site_name"),
  requisition_date: text("requisition_date").notNull(),
  priority: text("priority").notNull().default("medium"), // low | medium | high | urgent
  purpose: text("purpose"),
  notes: text("notes"),
  // Workflow status
  status: text("status").notNull().default("draft"), // draft | pending_checkers | pending_approver | on_hold | approved | rejected | assigned | in_progress | completed
  // Checker 1
  checker1_id: integer("checker1_id").references(() => usersTable.id),
  checker1_name: text("checker1_name"),
  checker1_suggestion: text("checker1_suggestion"),
  checker1_reviewed_at: timestamp("checker1_reviewed_at"),
  checker1_status: text("checker1_status"), // approved | rejected | pending
  // Checker 2
  checker2_id: integer("checker2_id").references(() => usersTable.id),
  checker2_name: text("checker2_name"),
  checker2_suggestion: text("checker2_suggestion"),
  checker2_reviewed_at: timestamp("checker2_reviewed_at"),
  checker2_status: text("checker2_status"), // approved | rejected | pending
  // Approver
  approver_id: integer("approver_id").references(() => usersTable.id),
  approver_name: text("approver_name"),
  approver_suggestion: text("approver_suggestion"),
  approver_reviewed_at: timestamp("approver_reviewed_at"),
  approver_status: text("approver_status"), // approved | rejected | pending
  // Purchase Head
  purchase_head_id: integer("purchase_head_id").references(() => usersTable.id),
  purchase_head_name: text("purchase_head_name"),
  assigned_to_id: integer("assigned_to_id").references(() => usersTable.id),
  assigned_to_name: text("assigned_to_name"),
  assigned_at: timestamp("assigned_at"),
  // Hold (an alternative to approve/reject at the approver stage)
  hold_reason: text("hold_reason"),
  held_at: timestamp("held_at"),
  pre_hold_status: text("pre_hold_status"), // status to restore to on Resume — checkers hold from "pending_checkers", approver holds from "pending_approver"
  // Directors for approval note — superseded by approval_notes table; kept
  // so existing rows aren't touched, no longer written by new code.
  director_ids: text("director_ids"), // JSON array of user ids
  director_names: text("director_names"), // JSON array of names
  // Timestamps
  submitted_at: timestamp("submitted_at"),
  approved_at: timestamp("approved_at"),
  completed_at: timestamp("completed_at"),
  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export type Requisition = typeof requisitionsTable.$inferSelect;
