import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalDepartmentController.js";

const r = Router();
r.use(requireInternalSecret);
r.get("/departments/:id", ctrl.getOne);

export const internalRoutes = r;
