import { Router } from "express";
import { db } from "@workspace/db";
import { pickupsTable } from "@workspace/db/schema";
import { CreatePickupBody, UpdatePickupBody, UpdatePickupParams, DeletePickupParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const pickups = await db.select().from(pickupsTable).orderBy(pickupsTable.plateNumber);
  res.json(pickups);
});

router.post("/", async (req, res) => {
  const body = CreatePickupBody.parse(req.body);
  const [pickup] = await db.insert(pickupsTable).values(body).returning();
  res.status(201).json(pickup);
});

router.put("/:id", async (req, res) => {
  const { id } = UpdatePickupParams.parse({ id: Number(req.params.id) });
  const body = UpdatePickupBody.parse(req.body);
  const [pickup] = await db.update(pickupsTable).set(body).where(eq(pickupsTable.id, id)).returning();
  if (!pickup) return res.status(404).json({ error: "Pickup not found" });
  res.json(pickup);
});

router.delete("/:id", async (req, res) => {
  const { id } = DeletePickupParams.parse({ id: Number(req.params.id) });
  await db.delete(pickupsTable).where(eq(pickupsTable.id, id));
  res.status(204).send();
});

export default router;
