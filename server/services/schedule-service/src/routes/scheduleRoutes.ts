import { Router } from "express";
import { requireAuth } from "@syt/shared";
import * as ctrl from "../controllers/scheduleController.js";

const r = Router();

r.get("/org-settings", requireAuth, ctrl.getOrgSettings);
r.patch("/org-settings", requireAuth, ctrl.adminOnly, ctrl.patchOrgSettings);

r.get("/day/:date", requireAuth, ctrl.day);
r.get("/month/:month", requireAuth, ctrl.month);
r.get("/week/:date", requireAuth, ctrl.week);

r.get("/", requireAuth, ctrl.list);
r.post("/range", requireAuth, ctrl.createRange);
r.post("/", requireAuth, ctrl.create);
r.put("/:id", requireAuth, ctrl.update);
r.delete("/:id", requireAuth, ctrl.remove);

export const scheduleRoutes = r;
