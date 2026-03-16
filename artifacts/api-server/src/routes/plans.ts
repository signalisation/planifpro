import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, assignmentsTable, clientsTable, employeesTable, pickupsTable } from "@workspace/db/schema";
import {
  CreatePlanBody,
  UpdatePlanBody,
  UpdatePlanParams,
  GetPlanParams,
  DeletePlanParams,
  SavePlanAssignmentsParams,
  SavePlanAssignmentsBody,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const plans = await db
    .select({
      id: plansTable.id,
      name: plansTable.name,
      clientId: plansTable.clientId,
      clientName: clientsTable.name,
      date: plansTable.date,
      notes: plansTable.notes,
      status: plansTable.status,
      createdAt: plansTable.createdAt,
    })
    .from(plansTable)
    .leftJoin(clientsTable, eq(plansTable.clientId, clientsTable.id))
    .orderBy(plansTable.date);
  res.json(plans);
});

router.post("/", async (req, res) => {
  const body = CreatePlanBody.parse(req.body);
  const [plan] = await db.insert(plansTable).values(body).returning();
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, plan.clientId));
  res.status(201).json({ ...plan, clientName: client?.name });
});

router.get("/:id", async (req, res) => {
  const { id } = GetPlanParams.parse({ id: Number(req.params.id) });
  const [plan] = await db
    .select({
      id: plansTable.id,
      name: plansTable.name,
      clientId: plansTable.clientId,
      clientName: clientsTable.name,
      date: plansTable.date,
      notes: plansTable.notes,
      status: plansTable.status,
      createdAt: plansTable.createdAt,
    })
    .from(plansTable)
    .leftJoin(clientsTable, eq(plansTable.clientId, clientsTable.id))
    .where(eq(plansTable.id, id));

  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const assignments = await db
    .select({
      id: assignmentsTable.id,
      planId: assignmentsTable.planId,
      employeeId: assignmentsTable.employeeId,
      pickupId: assignmentsTable.pickupId,
      position: assignmentsTable.position,
      notes: assignmentsTable.notes,
      employee: {
        id: employeesTable.id,
        firstName: employeesTable.firstName,
        lastName: employeesTable.lastName,
        role: employeesTable.role,
        department: employeesTable.department,
        phone: employeesTable.phone,
        email: employeesTable.email,
        employeeNumber: employeesTable.employeeNumber,
        status: employeesTable.status,
        createdAt: employeesTable.createdAt,
      },
      pickup: {
        id: pickupsTable.id,
        plateNumber: pickupsTable.plateNumber,
        model: pickupsTable.model,
        brand: pickupsTable.brand,
        year: pickupsTable.year,
        capacity: pickupsTable.capacity,
        status: pickupsTable.status,
        color: pickupsTable.color,
        createdAt: pickupsTable.createdAt,
      },
    })
    .from(assignmentsTable)
    .leftJoin(employeesTable, eq(assignmentsTable.employeeId, employeesTable.id))
    .leftJoin(pickupsTable, eq(assignmentsTable.pickupId, pickupsTable.id))
    .where(eq(assignmentsTable.planId, id))
    .orderBy(assignmentsTable.position);

  res.json({ ...plan, assignments });
});

router.put("/:id", async (req, res) => {
  const { id } = UpdatePlanParams.parse({ id: Number(req.params.id) });
  const body = UpdatePlanBody.parse(req.body);
  const [plan] = await db.update(plansTable).set(body).where(eq(plansTable.id, id)).returning();
  if (!plan) return res.status(404).json({ error: "Plan not found" });
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, plan.clientId));
  res.json({ ...plan, clientName: client?.name });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeletePlanParams.parse({ id: Number(req.params.id) });
  await db.delete(plansTable).where(eq(plansTable.id, id));
  res.status(204).send();
});

router.post("/:id/assignments", async (req, res) => {
  const { id } = SavePlanAssignmentsParams.parse({ id: Number(req.params.id) });
  const body = SavePlanAssignmentsBody.parse(req.body);

  // Delete existing assignments
  await db.delete(assignmentsTable).where(eq(assignmentsTable.planId, id));

  // Insert new assignments
  if (body.assignments.length > 0) {
    await db.insert(assignmentsTable).values(
      body.assignments.map((a) => ({
        planId: id,
        employeeId: a.employeeId ?? null,
        pickupId: a.pickupId ?? null,
        position: a.position,
        notes: a.notes ?? null,
      }))
    );
  }

  // Return updated plan detail
  const [plan] = await db
    .select({
      id: plansTable.id,
      name: plansTable.name,
      clientId: plansTable.clientId,
      clientName: clientsTable.name,
      date: plansTable.date,
      notes: plansTable.notes,
      status: plansTable.status,
      createdAt: plansTable.createdAt,
    })
    .from(plansTable)
    .leftJoin(clientsTable, eq(plansTable.clientId, clientsTable.id))
    .where(eq(plansTable.id, id));

  const assignments = await db
    .select({
      id: assignmentsTable.id,
      planId: assignmentsTable.planId,
      employeeId: assignmentsTable.employeeId,
      pickupId: assignmentsTable.pickupId,
      position: assignmentsTable.position,
      notes: assignmentsTable.notes,
      employee: {
        id: employeesTable.id,
        firstName: employeesTable.firstName,
        lastName: employeesTable.lastName,
        role: employeesTable.role,
        department: employeesTable.department,
        phone: employeesTable.phone,
        email: employeesTable.email,
        employeeNumber: employeesTable.employeeNumber,
        status: employeesTable.status,
        createdAt: employeesTable.createdAt,
      },
      pickup: {
        id: pickupsTable.id,
        plateNumber: pickupsTable.plateNumber,
        model: pickupsTable.model,
        brand: pickupsTable.brand,
        year: pickupsTable.year,
        capacity: pickupsTable.capacity,
        status: pickupsTable.status,
        color: pickupsTable.color,
        createdAt: pickupsTable.createdAt,
      },
    })
    .from(assignmentsTable)
    .leftJoin(employeesTable, eq(assignmentsTable.employeeId, employeesTable.id))
    .leftJoin(pickupsTable, eq(assignmentsTable.pickupId, pickupsTable.id))
    .where(eq(assignmentsTable.planId, id))
    .orderBy(assignmentsTable.position);

  res.json({ ...plan, assignments });
});

export default router;
