import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db/schema";
import { CreateEmployeeBody, UpdateEmployeeBody, UpdateEmployeeParams, DeleteEmployeeParams } from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const employees = await db.select().from(employeesTable).orderBy(employeesTable.lastName);
  res.json(employees);
});

router.post("/", async (req, res) => {
  const body = CreateEmployeeBody.parse(req.body);
  const [employee] = await db.insert(employeesTable).values(body).returning();
  res.status(201).json(employee);
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateEmployeeParams.parse({ id: Number(req.params.id) });
  const body = UpdateEmployeeBody.parse(req.body);
  const [employee] = await db.update(employeesTable).set(body).where(eq(employeesTable.id, id)).returning();
  if (!employee) return res.status(404).json({ error: "Employee not found" });
  res.json(employee);
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteEmployeeParams.parse({ id: Number(req.params.id) });
  await db.delete(employeesTable).where(eq(employeesTable.id, id));
  res.status(204).send();
});

export default router;
