/**
 * Loads active scheduling rules overlapping [from, to] (ISO UTC dates inclusive).
 */

import type { SchedulingRuleDoc } from "@syt/shared";

function isoLTE(a: string, b: string): boolean {
  return a <= b;
}

/** Rule effective range from payload.location_unavailable and similar. */
function ruleEffectiveRange(rule: SchedulingRuleDoc): { from?: string; to?: string } {
  const p = rule.payload as Record<string, unknown>;
  const from = typeof p.effectiveFrom === "string" ? p.effectiveFrom : undefined;
  const to = typeof p.effectiveTo === "string" ? p.effectiveTo : undefined;
  return { from, to };
}

export function filterRulesForRange(
  rules: SchedulingRuleDoc[],
  rangeFrom: string,
  rangeTo: string
): SchedulingRuleDoc[] {
  return rules.filter((r) => {
    if (!r.isActive) return false;
    const { from, to } = ruleEffectiveRange(r);
    if (!from && !to) return true;
    const effStart = from ?? "1970-01-01";
    const effEnd = to ?? "9999-12-31";
    return isoLTE(effStart, rangeTo) && isoLTE(rangeFrom, effEnd);
  });
}

export function summarizeRulesForAi(rules: SchedulingRuleDoc[]): unknown[] {
  return rules.map((r) => ({
    ruleType: r.ruleType,
    priority: r.priority,
    payload: r.payload,
  }));
}
