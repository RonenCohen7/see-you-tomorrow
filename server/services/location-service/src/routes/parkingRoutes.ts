import { Router } from "express";
import { requireAuth, requireAdmin } from "@syt/shared";
import * as ctrl from "../controllers/parkingController.js";

const r = Router();

r.get("/spots", requireAuth, ctrl.listSpots);
r.post("/spots", requireAuth, requireAdmin, ctrl.createSpot);
r.post("/spots/seed-ten", requireAuth, requireAdmin, ctrl.seedTen);
r.patch("/spots/:id", requireAuth, requireAdmin, ctrl.patchSpot);
r.delete("/spots/:id", requireAuth, requireAdmin, ctrl.deleteSpot);

r.get("/reservations", requireAuth, ctrl.listReservations);
r.post("/reservations", requireAuth, ctrl.createReservation);
r.delete("/reservations/:id", requireAuth, ctrl.deleteReservation);

export const parkingRoutes = r;
