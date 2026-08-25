import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companiesRouter from "./companies";
import projectsRouter from "./projects";
import sitesRouter from "./sites";
import usersRouter from "./users";
import requisitionsRouter from "./requisitions";
import workflowRouter from "./workflow";
import queriesRouter from "./queries";
import statusUpdatesRouter from "./status_updates";
import analyticsRouter from "./analytics";
import uploadRouter from "./upload";
import holidaysRouter from "./holidays";
import assetsRouter from "./assets";
import { requireAuth } from "../middlewares/require-auth";

const router: IRouter = Router();

// Public — no login required.
router.use(healthRouter);
router.use(authRouter);

// Everything below requires a logged-in session.
router.use(requireAuth);
router.use(companiesRouter);
router.use(projectsRouter);
router.use(sitesRouter);
router.use(usersRouter);
router.use(requisitionsRouter);
router.use(workflowRouter);
router.use(queriesRouter);
router.use(statusUpdatesRouter);
router.use(analyticsRouter);
router.use(uploadRouter);
router.use(holidaysRouter);
router.use(assetsRouter);

export default router;
