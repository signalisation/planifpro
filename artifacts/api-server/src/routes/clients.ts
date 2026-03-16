import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable } from "@workspace/db/schema";
import { CreateClientBody, UpdateClientBody, GetClientParams, UpdateClientParams, DeleteClientParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const clients = await db.select().from(clientsTable).orderBy(clientsTable.createdAt);
  res.json(clients);
});

router.post("/", async (req, res) => {
  const body = CreateClientBody.parse(req.body);
  const [client] = await db.insert(clientsTable).values(body).returning();
  res.status(201).json(client);
});

router.get("/:id", async (req, res) => {
  const { id } = GetClientParams.parse({ id: Number(req.params.id) });
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json(client);
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateClientParams.parse({ id: Number(req.params.id) });
  const body = UpdateClientBody.parse(req.body);
  const [client] = await db.update(clientsTable).set(body).where(eq(clientsTable.id, id)).returning();
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json(client);
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteClientParams.parse({ id: Number(req.params.id) });
  await db.delete(clientsTable).where(eq(clientsTable.id, id));
  res.status(204).send();
});

export default router;
