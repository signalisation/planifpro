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
import { eq, and, ne, inArray } from "drizzle-orm";

const router = Router();

// Override date field to accept string (JSON sends strings, not Date objects)
const CreatePlanBodyFixed = z.object({
  name: z.string(),
  clientId: z.number().optional(),
  date: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "confirmed", "completed"]).optional(),
});

const UpdatePlanBodyFixed = z.object({
  name: z.string().optional(),
  clientId: z.number().optional(),
  date: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "confirmed", "completed"]).optional(),
});

router.get("/busy-resources", async (req, res) => {
  // date: the date of the plan being edited (YYYY-MM-DD)
  // clientNow: current date+time from the browser as "YYYY-MM-DDTHH:MM" — avoids server timezone issues
  // excludePlanId: plan being edited, excluded from the search
  const { date, excludePlanId, clientNow } = req.query as {
    date?: string;
    excludePlanId?: string;
    clientNow?: string;
  };
  if (!date) return res.json({ busyEmpIds: [], busyPicIds: [] });

  // Use client-supplied current date/time to avoid server timezone mismatches
  let todayStr: string;
  let nowTime: string;
  if (clientNow && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(clientNow)) {
    [todayStr, nowTime] = clientNow.split('T') as [string, string];
  } else {
    const now = new Date();
    todayStr = now.toISOString().split('T')[0];
    nowTime = `${String(now.getUTCHours()).padStart(2,'0')}:${String(now.getUTCMinutes()).padStart(2,'0')}`;
  }

  const excludeId = excludePlanId ? Number(excludePlanId) : null;

  // Step 1 (parallel): get all plans and all assignments for non-excluded plans in one shot
  const [allPlans, allAssignments] = await Promise.all([
    db.select({ id: plansTable.id, date: plansTable.date })
      .from(plansTable)
      .where(excludeId ? ne(plansTable.id, excludeId) : undefined),
    db.select({
      planId: assignmentsTable.planId,
      employeeId: assignmentsTable.employeeId,
      pickupId: assignmentsTable.pickupId,
      position: assignmentsTable.position,
      notes: assignmentsTable.notes,
    }).from(assignmentsTable)
      .where(excludeId ? ne(assignmentsTable.planId, excludeId) : undefined),
  ]);

  const planDateMap = new Map<number, string>();
  allPlans.forEach(p => planDateMap.set(p.id, p.date as string));

  // Step 2: Parse block metadata from assignment rows (metadata rows: position % 200 === 0 with JSON notes)
  // key = "${planId}-${blockIdx}" → { startDate, endDate, endTime }
  const blockMeta = new Map<string, { sd: string; ed: string; et: string }>();
  const plansWithMeta = new Set<number>(); // tracks which plans have at least one metadata row

  allAssignments.forEach(a => {
    if (a.position % 200 !== 0 || !a.notes) return;
    try {
      const meta = JSON.parse(a.notes);
      const bi = Math.floor(a.position / 200);
      blockMeta.set(`${a.planId}-${bi}`, {
        sd: meta.sd ?? '',
        ed: meta.ed ?? '',
        et: meta.et ?? '',
      });
      plansWithMeta.add(a.planId);
    } catch {}
  });

  // Step 3: Determine which plans have blocks that overlap with [date]
  // A block overlaps if: startDate <= date AND endDate >= date
  const activePlanIds = new Set<number>();

  blockMeta.forEach((meta, key) => {
    const planId = Number(key.split('-')[0]);
    const sd = meta.sd;
    const ed = meta.ed;
    if (!ed) return; // no end date saved yet
    if (ed >= date && (sd <= date || !sd)) {
      activePlanIds.add(planId);
    }
  });

  // Fallback for plans without any block metadata: use plan.date directly
  allPlans.forEach(p => {
    if (!plansWithMeta.has(p.id) && (p.date as string) === date) {
      activePlanIds.add(p.id);
    }
  });

  if (activePlanIds.size === 0) return res.json({ busyEmpIds: [], busyPicIds: [] });

  // Step 4: Determine busy status per block and collect resource IDs
  const isBlockBusy = (planId: number, bi: number): boolean => {
    const meta = blockMeta.get(`${planId}-${bi}`);
    if (!meta || !meta.ed) {
      // No block metadata → fallback: busy if plan.date >= today
      return (planDateMap.get(planId) ?? '') >= todayStr;
    }
    if (meta.ed > todayStr) return true;   // block ends after today → busy
    if (meta.ed < todayStr) return false;  // block ended before today → free
    // Block ends today → compare time
    if (!meta.et) return true;             // no end time → assume whole day
    return meta.et > nowTime;             // busy until endTime passes
  };

  const busyEmpIds = new Set<number>();
  const busyPicIds = new Set<number>();

  allAssignments.forEach(a => {
    if (!activePlanIds.has(a.planId)) return;
    if (a.position % 200 === 0) return; // skip metadata rows
    const bi = Math.floor(a.position / 200);
    if (!isBlockBusy(a.planId, bi)) return;
    if (a.employeeId) busyEmpIds.add(a.employeeId);
    if (a.pickupId) busyPicIds.add(a.pickupId);
  });

  res.json({ busyEmpIds: [...busyEmpIds], busyPicIds: [...busyPicIds] });
});

router.get("/", async (_req, res) => {
  const plans = await db
    .select({
      id: plansTable.id,
      name: plansTable.name,
      clientId: plansTable.clientId,
      clientName: clientsTable.name,
      date: plansTable.date,
      startTime: plansTable.startTime,
      endTime: plansTable.endTime,
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
    startTime: body.startTime ?? null,
    endTime: body.endTime ?? null,
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
      startTime: plansTable.startTime,
      endTime: plansTable.endTime,
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
  if (body.startTime !== undefined) updateData.startTime = body.startTime || null;
  if (body.endTime !== undefined) updateData.endTime = body.endTime || null;
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
      startTime: plansTable.startTime,
      endTime: plansTable.endTime,
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
