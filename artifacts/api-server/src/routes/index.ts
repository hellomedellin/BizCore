import { Router, type IRouter } from "express";
import healthRouter from "./health";
import businessesRouter from "./businesses";
import locationsRouter from "./locations";
import modulesRouter from "./modules";
import dashboardRouter from "./dashboard";
import usersRouter from "./users";
import categoriesRouter from "./categories";
import itemsRouter from "./items";
import inventoryRouter from "./inventory";
import recipesRouter from "./recipes";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import employeesRouter from "./employees";
import schedulingRouter from "./scheduling";
import customFieldsRouter from "./custom-fields";

const router: IRouter = Router();

router.use(healthRouter);
router.use(businessesRouter);
router.use(locationsRouter);
router.use(modulesRouter);
router.use(dashboardRouter);
router.use(usersRouter);
router.use(categoriesRouter);
router.use(itemsRouter);
router.use(inventoryRouter);
router.use(recipesRouter);
router.use(customersRouter);
router.use(ordersRouter);
router.use(employeesRouter);
router.use(schedulingRouter);
router.use(customFieldsRouter);

export default router;
