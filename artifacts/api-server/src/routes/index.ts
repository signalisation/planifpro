import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import employeesRouter from "./employees";
import pickupsRouter from "./pickups";
import plansRouter from "./plans";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/clients", clientsRouter);
router.use("/employees", employeesRouter);
router.use("/pickups", pickupsRouter);
router.use("/plans", plansRouter);
router.use("/import", importRouter);

export default router;
