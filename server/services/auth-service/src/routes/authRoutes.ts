import { Router } from "express";
import { requireAuth } from "@syt/shared";
import * as ctrl from "../controllers/authController.js";

const r = Router();

r.post("/register", ctrl.register);
r.post("/login", ctrl.login);
r.post("/logout", ctrl.logout);
r.post("/refresh", ctrl.refresh);
r.get("/me", requireAuth, ctrl.me);

export const authRoutes = r;
