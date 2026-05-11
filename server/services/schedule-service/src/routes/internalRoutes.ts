import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalScheduleController.js";

const r = Router();
r.use(requireInternalSecret);

r.post("/schedules/apply-recommendations", ctrl.applyRecommendations);
r.post("/schedules/office-presence", ctrl.officePresenceBatch);

export const internalRoutes = r;
