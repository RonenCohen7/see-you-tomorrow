import {
  detectActiveConflictingRules,
  describeRuleImpact,
  impactTagLabel,
  summarizeRule,
  ruleTypeLabel,
  type SchedulingRuleType,
  type SchedulingRuleWire,
} from "@syt/shared";
import * as rules from "./schedulingRuleService.js";

export type LocationRef = { id: string; name: string };

export async function checkConflicts(input: {
  ruleType: SchedulingRuleType;
  payload: Record<string, unknown>;
  isActive?: boolean;
  locationNames?: LocationRef[];
  locale?: "he" | "en";
}) {
  const locale = input.locale ?? "he";
  const all = await rules.listRules();
  const draft = { ruleType: input.ruleType, payload: input.payload };
  const conflicts =
    input.isActive === false ? [] : detectActiveConflictingRules(draft, all);

  const locationMap = new Map((input.locationNames ?? []).map((l) => [l.id, l.name]));

  const summarize = (r: SchedulingRuleWire) => ({
    id: r.id,
    ruleType: r.ruleType,
    typeLabel: ruleTypeLabel(r.ruleType, locale),
    summary: summarizeRule(r, locale, locationMap),
    impactTags: describeRuleImpact(r.ruleType).map((t) => ({
      key: t,
      label: impactTagLabel(t, locale),
    })),
    isActive: r.isActive,
  });

  return {
    hasConflicts: conflicts.length > 0,
    conflicts: conflicts.map(summarize),
    draftSummary: summarizeRule(draft, locale, locationMap),
    draftTypeLabel: ruleTypeLabel(input.ruleType, locale),
    draftImpactTags: describeRuleImpact(input.ruleType).map((t) => ({
      key: t,
      label: impactTagLabel(t, locale),
    })),
  };
}

export async function listRulesWithSummaries(locationNames: LocationRef[], locale: "he" | "en" = "he") {
  const all = await rules.listRules();
  const locationMap = new Map(locationNames.map((l) => [l.id, l.name]));
  return all.map((r) => ({
    ...r,
    typeLabel: ruleTypeLabel(r.ruleType, locale),
    summary: summarizeRule(r, locale, locationMap),
    impactTags: describeRuleImpact(r.ruleType).map((t) => ({
      key: t,
      label: impactTagLabel(t, locale),
    })),
  }));
}
