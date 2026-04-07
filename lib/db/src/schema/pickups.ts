import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pickupsTable = pgTable("pickups", {
  id: serial("id").primaryKey(),
  unitNumber: text("unit_number"),
  plateNumber: text("plate_number"),
  model: text("model"),
  brand: text("brand"),
  year: integer("year"),
  capacity: integer("capacity"),
  status: text("status").notNull().default("available"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPickupSchema = createInsertSchema(pickupsTable).omit({ id: true, createdAt: true });
export type InsertPickup = z.infer<typeof insertPickupSchema>;
export type Pickup = typeof pickupsTable.$inferSelect;
