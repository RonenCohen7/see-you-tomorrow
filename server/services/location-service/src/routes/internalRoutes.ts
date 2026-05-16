import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalLocationController.js";

const r = Router();
r.use(requireInternalSecret);
r.get("/locations/:id", ctrl.getOne);
r.post("/parking/sync-manager-office-auto", ctrl.syncManagerOfficeAutoParking);

export const internalRoutes = r;
