import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalLocationController.js";

const r = Router();
r.use(requireInternalSecret);
r.get("/locations/:id", ctrl.getOne);

export const internalRoutes = r;
