import { Router } from "express";
import { requireAuth, requireRoles } from "@syt/shared";
import * as ctrl from "../controllers/notificationController.js";

const r = Router();

r.get("/", requireAuth, ctrl.list);
r.get("/unread-count", requireAuth, ctrl.unread);
r.get("/system-broadcasts/pending", requireAuth, ctrl.pendingSystemBroadcasts);
r.post("/system-broadcasts/:id/dismiss", requireAuth, ctrl.dismissSystemBroadcast);
r.put("/read-all", requireAuth, ctrl.markAllRead);
r.delete("/mine", requireAuth, ctrl.dismissAll);
r.put("/:id/read", requireAuth, ctrl.markRead);
r.post("/admin/system-broadcast", requireAuth, requireRoles("admin", "manager"), ctrl.adminSystemBroadcast);

export const notificationRoutes = r;
