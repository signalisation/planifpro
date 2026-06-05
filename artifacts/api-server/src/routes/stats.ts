import { Router } from "express";
import { db } from "@workspace/db";
import { plansTable, assignmentsTable, clientsTable, employeesTable, pickupsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/interventions", async (_req, res) => {
  const plans = await db
    .select({
      id: plansTable.id,
      name: plansTable.name,
      date: plansTable.date,
      status: plansTable.status,
      clientId: plansTable.clientId,
      clientName: clientsTable.name,
    })
    .from(plansTable)
    .leftJoin(clientsTable, eq(plansTable.clientId, clientsTable.id))
    .orderBy(plansTable.date);

  const assignments = await db
    .select({
      planId: assignmentsTable.planId,
      employeeId: assignmentsTable.employeeId,
      pickupId: assignmentsTable.pickupId,
    })
    .from(assignmentsTable);

  const assignmentsByPlan = new Map<number, { employeeIds: Set<number>; pickupIds: Set<number> }>();
  for (const a of assignments) {
    if (!assignmentsByPlan.has(a.planId)) {
      assignmentsByPlan.set(a.planId, { employeeIds: new Set(), pickupIds: new Set() });
    }
    const bucket = assignmentsByPlan.get(a.planId)!;
    if (a.employeeId) bucket.employeeIds.add(a.employeeId);
    if (a.pickupId) bucket.pickupIds.add(a.pickupId);
  }

  const clientMap = new Map<
    number | null,
    {
      clientId: number | null;
      clientName: string | null;
      totalPlans: number;
      confirmedPlans: number;
      draftPlans: number;
      completedPlans: number;
      uniqueEmployees: Set<number>;
      uniquePickups: Set<number>;
      lastPlanDate: string | null;
      recentPlans: Array<{ id: number; name: string; date: string; status: string }>;
    }
  >();

  for (const plan of plans) {
    const key = plan.clientId ?? null;
    if (!clientMap.has(key)) {
      clientMap.set(key, {
        clientId: key,
        clientName: plan.clientName ?? null,
        totalPlans: 0,
        confirmedPlans: 0,
        draftPlans: 0,
        completedPlans: 0,
        uniqueEmployees: new Set(),
        uniquePickups: new Set(),
        lastPlanDate: null,
        recentPlans: [],
      });
    }
    const entry = clientMap.get(key)!;
    entry.totalPlans += 1;
    if (plan.status === "confirmed") entry.confirmedPlans += 1;
    else if (plan.status === "draft") entry.draftPlans += 1;
    else if (plan.status === "completed") entry.completedPlans += 1;

    if (!entry.lastPlanDate || plan.date > entry.lastPlanDate) {
      entry.lastPlanDate = plan.date;
    }

    const asgn = assignmentsByPlan.get(plan.id);
    if (asgn) {
      for (const eid of asgn.employeeIds) entry.uniqueEmployees.add(eid);
      for (const pid of asgn.pickupIds) entry.uniquePickups.add(pid);
    }

    entry.recentPlans.push({ id: plan.id, name: plan.name, date: plan.date, status: plan.status });
  }

  const result = Array.from(clientMap.values())
    .sort((a, b) => {
      if (a.lastPlanDate && b.lastPlanDate) return b.lastPlanDate.localeCompare(a.lastPlanDate);
      if (a.lastPlanDate) return -1;
      if (b.lastPlanDate) return 1;
      return 0;
    })
    .map((entry) => ({
      clientId: entry.clientId,
      clientName: entry.clientName ?? "Sans client",
      totalPlans: entry.totalPlans,
      confirmedPlans: entry.confirmedPlans,
      draftPlans: entry.draftPlans,
      completedPlans: entry.completedPlans,
      uniqueEmployees: entry.uniqueEmployees.size,
      uniquePickups: entry.uniquePickups.size,
      lastPlanDate: entry.lastPlanDate,
      recentPlans: entry.recentPlans
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    }));

  res.json(result);
});

export default router;
