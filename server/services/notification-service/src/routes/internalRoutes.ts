import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalNotificationController.js";

const r = Router();
r.use(requireInternalSecret);

r.post("/notifications/schedule-change", ctrl.scheduleChange);
r.post("/notifications/schedule-range-change", ctrl.scheduleRangeChange);
r.post("/notifications/email-attachment", ctrl.emailAttachment);

export const internalRoutes = r;
