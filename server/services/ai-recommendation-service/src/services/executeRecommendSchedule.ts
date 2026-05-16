import type { SchedulingRuleDoc } from "@syt/shared";
import { recommendSchema } from "../validations/ai.js";
import * as agg from "./contextAggregator.js";
import * as ai from "./openAiRecommend.js";
import * as validation from "./validateScheduleRecommendations.js";
import * as prefInsight from "./preferenceInsight.js";
import type { z } from "zod";

export type RecommendInput = z.infer<typeof recommendSchema>;

export type ExecuteRecommendOptions = {
  /** When set, JWT bearer for schedule-service list; otherwise uses internal department-range route. */
  authorizationHeader?: string;
  /** For log context only when called from internal/automation. */
  actingUserId?: string;
  /**
   * When true (default): validate that enough managers/admins are "office" per org rules —
   * used by the interactive AI Recommendations UI for a full departmental proposal.
   * When false (preference pipeline internal): skips that gate so employee-driven batches
   * can still reach manager approval / calendar policy separately.
   */
  enforceManagerDailyOfficeCoverage?: boolean;
  /**
   * When set, overrides `input.allowFridaySaturdayOffice` (internal pipeline forces `false`).
   */
  allowFridaySaturdayOffice?: boolean;
};

export async function executeRecommend(
  input: RecommendInput,
  options: ExecuteRecommendOptions = {}
): Promise<{
  recommendations: Array<{ date: string; employeeId: string; recommendedStatus: string; reason?: string }>;
  confidence?: number;
  model?: string;
  validation: ReturnType<typeof validation.validateScheduleRecommendations>;
  preferenceContext: ReturnType<typeof prefInsight.summarizeLoadedPreferences>;
  preferenceVsRecommendation: ReturnType<typeof prefInsight.summarizePreferenceVsRecommendations>;
}> {
  void options.actingUserId;
  const enforceManagerDailyOfficeCoverage = options.enforceManagerDailyOfficeCoverage ?? true;
  const allowFridaySaturdayOffice =
    options.allowFridaySaturdayOffice !== undefined
      ? options.allowFridaySaturdayOffice === true
      : input.allowFridaySaturdayOffice === true;

  const RULE_TYPES_EXCLUDED_FROM_AI_PROMPT = new Set<string>(["manager_office_auto_parking"]);

  const employeesFull = await agg.loadDepartmentEmployees(input.departmentId);
  const capacity = await agg.loadLocationCapacity(input.locationId);
  const historical = await agg.loadSchedulesRangeForRecommend({
    authHeader: options.authorizationHeader,
    departmentId: input.departmentId,
    from: input.dateRange.from,
    to: input.dateRange.to,
  });
  const activeSchedulingRulesRaw = await agg.loadSchedulingRulesForRange(
    input.dateRange.from,
    input.dateRange.to
  );
  const activeSchedulingRules = activeSchedulingRulesRaw.filter(
    (r) =>
      r &&
      typeof r === "object" &&
      "ruleType" in r &&
      !RULE_TYPES_EXCLUDED_FROM_AI_PROMPT.has(String((r as { ruleType: string }).ruleType))
  );
  const employeePreferencesSubmitted = await agg.loadDepartmentPreferencesBetween(
    input.departmentId,
    input.dateRange.from,
    input.dateRange.to
  );

  const employees = employeesFull.map((e) => ({ id: e.id, fullName: e.fullName }));

  const result = await ai.generateRecommendationsPrompt({
    departmentId: input.departmentId,
    locationId: input.locationId,
    dateRange: input.dateRange,
    constraints: input.constraints,
    employees,
    capacity: capacity?.capacity,
    historicalSummaries: historical,
    activeSchedulingRules,
    employeePreferencesSubmitted,
    policyAllowFridaySaturdayOffice: allowFridaySaturdayOffice,
  });

  const validated = validation.validateScheduleRecommendations({
    recommendations: result.recommendations,
    employees: employeesFull.map((e) => ({ id: e.id, role: e.role ?? "employee" })),
    rules: activeSchedulingRulesRaw as SchedulingRuleDoc[],
    assignmentLocationId: input.locationId,
    enforceManagerDailyOfficeCoverage,
    allowFridaySaturdayOffice,
  });

  const preferenceContext = prefInsight.summarizeLoadedPreferences(employeePreferencesSubmitted);
  const prefLookup = prefInsight.preferenceLookupFromDocs(employeePreferencesSubmitted);
  const preferenceVsRecommendation = prefInsight.summarizePreferenceVsRecommendations(
    result.recommendations,
    prefLookup
  );

  return {
    ...result,
    validation: validated,
    preferenceContext,
    preferenceVsRecommendation,
  };
}
