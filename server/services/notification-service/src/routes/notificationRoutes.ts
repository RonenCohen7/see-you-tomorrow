import { Router } from "express";
import { requireAuth, requireAdmin } from "@syt/shared";
import * as ctrl from "../controllers/notificationController.js";

const r = Router();

r.get("/", requireAuth, ctrl.list);
r.get("/unread-count", requireAuth, ctrl.unread);
r.put("/read-all", requireAuth, ctrl.markAllRead);
r.delete("/mine", requireAuth, ctrl.dismissAll);
r.put("/:id/read", requireAuth, ctrl.markRead);
r.post("/admin/system-broadcast", requireAuth, requireAdmin, ctrl.adminSystemBroadcast);

export const notificationRoutes = r;
