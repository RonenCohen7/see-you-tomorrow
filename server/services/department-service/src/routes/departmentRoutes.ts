import { Router } from "express";
import { requireAuth } from "@syt/shared";
import * as ctrl from "../controllers/departmentController.js";

const r = Router();

r.get("/", requireAuth, ctrl.list);
r.get("/:id", requireAuth, ctrl.getOne);
r.post("/", requireAuth, ctrl.adminOnly, ctrl.create);
r.put("/:id", requireAuth, ctrl.adminOnly, ctrl.update);
r.delete("/:id", requireAuth, ctrl.adminOnly, ctrl.remove);

export const departmentRoutes = r;
