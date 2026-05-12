import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalController.js";

const r = Router();
r.use(requireInternalSecret);

r.get("/employees/admins", ctrl.adminIds);
r.get("/employees/by-role/:role/ids", ctrl.listIdsByRole);
r.get("/employees/:id", ctrl.getOne);
r.get("/departments/:departmentId/employees", ctrl.byDepartment);

export const internalRoutes = r;
