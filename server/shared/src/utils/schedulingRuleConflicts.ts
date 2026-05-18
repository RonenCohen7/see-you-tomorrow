import type { SchedulingRuleType } from "../models/schedulingRule.js";

export type SchedulingRuleWire = {
  id: string;
  ruleType: SchedulingRuleType;
  payload: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

export type RuleDraftInput = {
  ruleType: SchedulingRuleType;
  payload: Record<string, unknown>;
};

function dateRangesOverlap(
  af: string | undefined,
  at: string | undefined,
  bf: string | undefined,
  bt: string | undefined,
): boolean {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  const aStart = af && re.test(af) ? af : "1970-01-01";
  const aEnd = at && re.test(at) ? at : "9999-12-31";
  const bStart = bf && re.test(bf) ? bf : "1970-01-01";
  const bEnd = bt && re.test(bt) ? bt : "9999-12-31";
  return aStart <= bEnd && bStart <= aEnd;
}

/** Active rules that conflict with a proposed rule (same semantics as client wizard). */
export function detectActiveConflictingRules(
  draft: RuleDraftInput,
  existing: SchedulingRuleWire[],
): SchedulingRuleWire[] {
  const act = existing.filter((r) => r.isActive);
  const byId = new Map<string, SchedulingRuleWire>();

  const push = (r: SchedulingRuleWire) => {
    byId.set(r.id, r);
  };

  if (draft.ruleType === "manager_office_auto_parking") {
    act.filter((r) => r.ruleType === "manager_office_auto_parking").forEach(push);
  }

  if (draft.ruleType === "min_managers_office_daily") {
    act.filter((r) => r.ruleType === "min_managers_office_daily").forEach(push);
  }

  if (draft.ruleType === "location_unavailable") {
    const lid = typeof draft.payload.locationId === "string" ? draft.payload.locationId : "";
    const af = typeof draft.payload.effectiveFrom === "string" ? draft.payload.effectiveFrom : undefined;
    const atRaw = draft.payload.effectiveTo;
    const at = typeof atRaw === "string" ? atRaw : undefined;
    for (const r of act) {
      if (r.ruleType !== "location_unavailable") continue;
      const p = r.payload;
      const rlid = typeof p.locationId === "string" ? p.locationId : "";
      if (rlid !== lid) continue;
      const bf = typeof p.effectiveFrom === "string" ? p.effectiveFrom : undefined;
      const btRaw = p.effectiveTo;
      const bt = typeof btRaw === "string" ? btRaw : undefined;
      if (dateRangesOverlap(af, at, bf, bt)) push(r);
    }
  }

  return [...byId.values()];
}
