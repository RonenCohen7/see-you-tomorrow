import { Router } from "express";
import { requireAuth } from "@syt/shared";
import * as ctrl from "../controllers/meetingController.js";

const r = Router();

r.get("/rooms", requireAuth, ctrl.listRooms);
r.post("/rooms", requireAuth, ctrl.adminOnly, ctrl.createRoom);
r.patch("/rooms/:id", requireAuth, ctrl.adminOnly, ctrl.patchRoom);
r.delete("/rooms/:id", requireAuth, ctrl.adminOnly, ctrl.deleteRoom);

r.get("/bookings", requireAuth, ctrl.listBookings);
r.get("/bookings/:id", requireAuth, ctrl.getBooking);
r.post("/bookings", requireAuth, ctrl.createBooking);
r.patch("/bookings/:id", requireAuth, ctrl.patchBooking);
r.delete("/bookings/:id", requireAuth, ctrl.deleteBooking);

export const meetingRoutes = r;
