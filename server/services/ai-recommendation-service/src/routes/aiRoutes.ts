import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireAdmin } from "@syt/shared";
import * as ctrl from "../controllers/aiController.js";
import * as assistantCtrl from "../controllers/assistantController.js";

const r = Router();

const assistantChatLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.ASSISTANT_CHAT_RATE_MAX ?? 24),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "יותר מדי בקשות לעוזר — נסו שוב בעוד דקה", code: "RATE_LIMIT" },
});

r.post("/recommend-schedule", requireAuth, ctrl.recommendSchedule);
r.post("/approve-recommendations", requireAuth, ctrl.approveRecommendations);
r.post("/draft-scheduling-rule", requireAuth, requireAdmin, ctrl.draftSchedulingRuleFromText);
r.post("/assistant/chat", requireAuth, assistantChatLimiter, assistantCtrl.assistantChat);

export const aiRoutes = r;
