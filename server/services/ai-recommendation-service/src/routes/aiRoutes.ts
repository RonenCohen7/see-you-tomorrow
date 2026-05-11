import { Router } from "express";
import { requireAuth } from "@syt/shared";
import * as ctrl from "../controllers/aiController.js";

const r = Router();

r.post("/recommend-schedule", requireAuth, ctrl.recommendSchedule);
r.post("/approve-recommendations", requireAuth, ctrl.adminOnly, ctrl.approveRecommendations);

export const aiRoutes = r;
