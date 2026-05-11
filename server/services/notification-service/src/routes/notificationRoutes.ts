import { Router } from "express";
import { requireAuth } from "@syt/shared";
import * as ctrl from "../controllers/notificationController.js";

const r = Router();

r.get("/", requireAuth, ctrl.list);
r.get("/unread-count", requireAuth, ctrl.unread);
r.put("/:id/read", requireAuth, ctrl.markRead);

export const notificationRoutes = r;
