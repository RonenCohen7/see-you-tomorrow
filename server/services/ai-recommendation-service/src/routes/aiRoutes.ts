import { Router } from "express";
import { requireAuth, requireAdmin } from "@syt/shared";
import * as ctrl from "../controllers/aiController.js";

const r = Router();

r.post("/recommend-schedule", requireAuth, ctrl.recommendSchedule);
r.post("/approve-recommendations", requireAuth, ctrl.approveRecommendations);
r.post("/draft-scheduling-rule", requireAuth, requireAdmin, ctrl.draftSchedulingRuleFromText);

export const aiRoutes = r;
