import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalController.js";

const r = Router();
r.use(requireInternalSecret);
r.delete("/tokens/:userId", ctrl.revokeUserTokens);

export const internalRoutes = r;
