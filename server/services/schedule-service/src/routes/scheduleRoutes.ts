import { Router } from "express";
import { requireAuth } from "@syt/shared";
import * as ctrl from "../controllers/scheduleController.js";
import * as prefCtrl from "../controllers/preferenceController.js";
import * as aiBatchCtrl from "../controllers/scheduleAiBatchController.js";
import * as ruleCtrl from "../controllers/schedulingRuleController.js";

const r = Router();

r.get("/org-settings", requireAuth, ctrl.getOrgSettings);
r.patch("/org-settings", requireAuth, ctrl.adminOnly, ctrl.patchOrgSettings);

r.get("/preferences/context", requireAuth, prefCtrl.getContext);
r.get("/preferences/attendance/week/:weekStartSunday", requireAuth, prefCtrl.getWeek);
r.put("/preferences/attendance", requireAuth, prefCtrl.putWeek);
r.get("/preferences/attendance/pipeline", requireAuth, prefCtrl.getPipelineStatus);
r.get("/preferences/attendance/dept", requireAuth, prefCtrl.listDeptSubmitted);
r.get("/preferences/attendance/dept-pipeline", requireAuth, prefCtrl.getDeptPipelineStatus);
r.get("/ai-batches/pending-pipeline", requireAuth, aiBatchCtrl.listPendingPreferencePipeline);
r.post("/ai-batches/:id/reject-pipeline", requireAuth, aiBatchCtrl.rejectAiBatch);

r.get("/scheduling-rules", requireAuth, ruleCtrl.schedulingRuleAdmin, ruleCtrl.list);
r.post("/scheduling-rules", requireAuth, ruleCtrl.schedulingRuleAdmin, ruleCtrl.create);
r.patch("/scheduling-rules/:id", requireAuth, ruleCtrl.schedulingRuleAdmin, ruleCtrl.update);
r.delete("/scheduling-rules/:id", requireAuth, ruleCtrl.schedulingRuleAdmin, ruleCtrl.remove);

r.get("/day/:date", requireAuth, ctrl.day);
r.get("/month/:month", requireAuth, ctrl.month);
r.get("/week/:date", requireAuth, ctrl.week);

r.get("/", requireAuth, ctrl.list);
r.post("/range", requireAuth, ctrl.createRange);
r.post("/department-range/preview", requireAuth, ctrl.previewDepartmentRange);
r.post("/department-range/apply", requireAuth, ctrl.applyDepartmentRange);
r.post("/week-grid/apply", requireAuth, ctrl.applyWeekGrid);
r.post("/", requireAuth, ctrl.create);
r.put("/:id/replace-range", requireAuth, ctrl.replaceRange);
r.put("/:id", requireAuth, ctrl.update);
r.delete("/:id", requireAuth, ctrl.remove);

export const scheduleRoutes = r;
