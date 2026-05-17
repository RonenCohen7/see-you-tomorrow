import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalScheduleController.js";
import * as ctxCtrl from "../controllers/internalScheduleContextController.js";
import * as rem from "../controllers/internalScheduleReminderController.js";

import * as deptSch from "../controllers/internalDepartmentSchedulesController.js";

const r = Router();
r.use(requireInternalSecret);

r.post("/schedules/apply-recommendations", ctrl.applyRecommendations);
r.post("/schedules/office-presence", ctrl.officePresenceBatch);
r.post("/schedules/clear-future-for-employee", deptSch.clearFutureForEmployee);
r.get("/schedules/department-range-for-ai", deptSch.listDepartmentRangeForAi);
r.get("/scheduling-rules/active", ctxCtrl.schedulingRulesRange);
r.get("/attendance-preferences/dept-range", ctxCtrl.preferencesDeptRange);
r.get("/org/preference-reminder-settings", rem.orgPreferenceSnippet);
r.get("/reminders/preference-envelope", rem.preferenceReminderEnvelope);
r.post("/attendance-preferences/missing-submitters", rem.preferenceMissingSubmitters);

export const internalRoutes = r;
