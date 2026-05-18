import { Router } from "express";
import { requireAuth } from "@syt/shared";
import * as ctrl from "../controllers/reportController.js";

const r = Router();
r.use(requireAuth, ctrl.managerOrAdmin);

r.get("/daily-status/preview", ctrl.dailyStatusPreview);
r.post("/daily-status/email", ctrl.dailyStatusEmail);

r.get("/parking-assignments/preview", ctrl.parkingPreview);
r.post("/parking-assignments/email", ctrl.parkingEmail);

export const reportRoutes = r;
