import { Router } from "express";
import { requireAuth } from "@syt/shared";
import * as ctrl from "../controllers/employeeController.js";

const r = Router();

r.get("/me", requireAuth, ctrl.getMe);
r.put("/me/department", requireAuth, ctrl.selfAssignDepartment);
r.get("/birthdays-range", requireAuth, ctrl.birthdaysRange);
r.post("/import-bulk", requireAuth, ctrl.managerOrAdmin, ctrl.importBulk);
r.get("/", requireAuth, ctrl.list);
r.get("/:id", requireAuth, ctrl.getOne);
r.post("/", requireAuth, ctrl.managerOrAdmin, ctrl.create);
r.put("/:id", requireAuth, ctrl.managerOrAdmin, ctrl.update);
r.delete("/:id", requireAuth, ctrl.adminOnly, ctrl.remove);

export const employeeRoutes = r;
