import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalNotificationController.js";

const r = Router();
r.use(requireInternalSecret);

r.post("/notifications/schedule-change", ctrl.scheduleChange);

export const internalRoutes = r;
