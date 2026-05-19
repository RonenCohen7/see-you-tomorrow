import { Router } from "express";
import { requireInternalSecret } from "@syt/shared";
import * as ctrl from "../controllers/internalNotificationController.js";

const r = Router();
r.use(requireInternalSecret);

r.post("/notifications/dashboard-refresh", ctrl.dashboardRefresh);
r.post("/notifications/schedule-change", ctrl.scheduleChange);
r.post("/notifications/schedule-range-change", ctrl.scheduleRangeChange);
r.post("/notifications/meeting-invite", ctrl.meetingInvite);
r.post("/notifications/preference-submitted", ctrl.preferenceSubmitted);
r.post("/notifications/preference-pipeline-queued", ctrl.preferencePipelineQueued);
r.post("/notifications/preference-pipeline-ai-ready", ctrl.preferencePipelineAiReady);
r.post("/notifications/preference-pipeline-ai-failed", ctrl.preferencePipelineAiFailed);
r.post("/notifications/preference-pipeline-validation-managers", ctrl.preferencePipelineValidationManagers);
r.post("/notifications/preference-pipeline-no-location", ctrl.preferencePipelineNoLocation);
r.post("/notifications/preference-pipeline-applied", ctrl.preferencePipelineApplied);
r.post("/notifications/preference-pipeline-rejected", ctrl.preferencePipelineRejected);
r.post("/notifications/preference-pipeline-batch-pending-managers", ctrl.preferencePipelineBatchPendingManagers);
r.post("/notifications/email-attachment", ctrl.emailAttachment);
r.post("/notifications/password-reset-email", ctrl.passwordResetEmail);
r.post("/notifications/scheduling-rule-proposal", ctrl.schedulingRuleProposal);

export const internalRoutes = r;
