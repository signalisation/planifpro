import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, pickupsTable } from "@workspace/db/schema";
import { ImportEmployeesBody, ImportPickupsBody } from "@workspace/api-zod";

const router = Router();

router.post("/employees", async (req, res) => {
  const body = ImportEmployeesBody.parse(req.body);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const emp of body.employees) {
    try {
      await db.insert(employeesTable).values({
        firstName: emp.firstName,
        lastName: emp.lastName,
        role: emp.role ?? null,
        department: emp.department ?? null,
        phone: emp.phone ?? null,
        email: emp.email ?? null,
        employeeNumber: emp.employeeNumber ?? null,
        status: emp.status ?? "active",
      });
      imported++;
    } catch (err) {
      skipped++;
      errors.push(`Erreur pour ${emp.firstName} ${emp.lastName}: ${(err as Error).message}`);
    }
  }

  res.json({ imported, skipped, errors });
});

router.post("/pickups", async (req, res) => {
  const body = ImportPickupsBody.parse(req.body);
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const pickup of body.pickups) {
    try {
      await db.insert(pickupsTable).values({
        plateNumber: pickup.plateNumber,
        model: pickup.model ?? null,
        brand: pickup.brand ?? null,
        year: pickup.year ?? null,
        capacity: pickup.capacity ?? null,
        status: pickup.status ?? "available",
        color: pickup.color ?? null,
      });
      imported++;
    } catch (err) {
      skipped++;
      errors.push(`Erreur pour ${pickup.plateNumber}: ${(err as Error).message}`);
    }
  }

  res.json({ imported, skipped, errors });
});

export default router;
