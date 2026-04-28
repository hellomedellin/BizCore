import { Router, type IRouter } from "express";
import healthRouter from "./health";
import businessesRouter from "./businesses";
import locationsRouter from "./locations";
import modulesRouter from "./modules";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(businessesRouter);
router.use(locationsRouter);
router.use(modulesRouter);
router.use(dashboardRouter);

export default router;
