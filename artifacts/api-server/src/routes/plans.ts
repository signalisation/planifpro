import { Router } from "express";
import { z } from "zod/v4";
import { db } from "@workspace/db";
import { plansTable, assignmentsTable, clientsTable, employeesTable, pickupsTable } from "@workspace/db/schema";
import {
  UpdatePlanParams,
  GetPlanParams,
  DeletePlanParams,
  SavePlanAssignmentsParams,
  SavePlanAssignmentsBody,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";

const router = Router();

// Override date field to accept string (JSON sends strings, not Date objects)
const CreatePlanBodyFixed = z.object({
  name: z.string(),
  clientId: z.number().optional(),
  date: z.string(),
  notes: z.string().optional(),
  status: z.enum(["draft", "confirmed", "completed"]).optional(),
});

const UpdatePlanBodyFixed = z.object({
  name: z.string().optional(),
  clientId: z.number().optional(),
  date: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "confirmed", "completed"]).optional(),
});

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
  const body = CreatePlanBodyFixed.parse(req.body);
  const [plan] = await db.insert(plansTable).values({
    name: body.name,
    clientId: body.clientId ?? null,
    date: body.date,
    notes: body.notes ?? null,
    status: body.status ?? "draft",
  }).returning();
  const client = plan.clientId
    ? (await db.select().from(clientsTable).where(eq(clientsTable.id, plan.clientId)))[0]
    : null;
  res.status(201).json({ ...plan, clientName: client?.name ?? null });
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

  if (!plan) return res.status(404).json({ error: "Plan introuvable" });

  const assignments = await db
    .select({
      id: assignmentsTable.id,
      planId: assignmentsTable.planId,
      clientId: assignmentsTable.clientId,
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
  const body = UpdatePlanBodyFixed.parse(req.body);
  const updateData: any = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.clientId !== undefined) updateData.clientId = body.clientId;
  if (body.date !== undefined) updateData.date = body.date;
  if (body.notes !== undefined) updateData.notes = body.notes;
  if (body.status !== undefined) updateData.status = body.status;

  const [plan] = await db.update(plansTable).set(updateData).where(eq(plansTable.id, id)).returning();
  if (!plan) return res.status(404).json({ error: "Plan introuvable" });
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, plan.clientId));
  res.json({ ...plan, clientName: client?.name ?? null });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeletePlanParams.parse({ id: Number(req.params.id) });
  await db.delete(plansTable).where(eq(plansTable.id, id));
  res.status(204).send();
});

const SavePlanAssignmentsBodyFixed = z.object({
  assignments: z.array(z.object({
    clientId: z.number().optional(),
    employeeId: z.number().optional(),
    pickupId: z.number().optional(),
    position: z.number(),
    notes: z.string().optional(),
  })),
});

router.post("/:id/assignments", async (req, res) => {
  const { id } = SavePlanAssignmentsParams.parse({ id: Number(req.params.id) });
  const body = SavePlanAssignmentsBodyFixed.parse(req.body);

  // Delete existing assignments
  await db.delete(assignmentsTable).where(eq(assignmentsTable.planId, id));

  // Insert new assignments
  if (body.assignments.length > 0) {
    await db.insert(assignmentsTable).values(
      body.assignments.map((a) => ({
        planId: id,
        clientId: a.clientId ?? null,
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
      clientId: assignmentsTable.clientId,
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
