import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalAiController.js";

const r = Router();
r.use(requireInternalSecret);

r.post("/recommend-schedule", ctrl.internalRecommendSchedule);

export const internalAiRoutes = r;
