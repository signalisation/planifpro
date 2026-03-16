import { pgTable, serial, text, integer, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { employeesTable } from "./employees";
import { pickupsTable } from "./pickups";

export const plansTable = pgTable("plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id),
  date: date("date").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => plansTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  pickupId: integer("pickup_id").references(() => pickupsTable.id),
  position: integer("position").notNull().default(0),
  notes: text("notes"),
});

export const insertPlanSchema = createInsertSchema(plansTable).omit({ id: true, createdAt: true });
export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({ id: true });
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Plan = typeof plansTable.$inferSelect;
export type Assignment = typeof assignmentsTable.$inferSelect;
