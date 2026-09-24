import { isUtcFridayOrSaturday } from "../utils/weekendPolicyUtc.js";

const SUBMITTED_PREFERENCE_STATUSES = new Set(["office", "home", "vacation", "off"]);

/** Preference docs from schedule-service internal `/attendance-preferences/dept-range` (public-ish shape). */
type PrefDocLike = {
  employeeId?: string;
  status?: string;
  days?: Array<{ workDate?: string; preference?: string }>;
};

export function summarizeLoadedPreferences(prefs: unknown[]) {
  let submittedPreferenceDocuments = 0;
  let employeeDaysWithPreference = 0;
  const employeesWithSubmittedPrefs = new Set<string>();

  for (const raw of prefs) {
    const p = raw as PrefDocLike;
    if (!p.employeeId || !Array.isArray(p.days)) continue;
    if (p.status !== "submitted") continue;
    submittedPreferenceDocuments++;
    employeesWithSubmittedPrefs.add(p.employeeId);
    for (const d of p.days) {
      if (d.preference && typeof d.preference === "string") employeeDaysWithPreference++;
    }
  }

  return {
    submittedPreferenceDocuments,
    employeesWithSubmittedPrefs: employeesWithSubmittedPrefs.size,
    employeeDaysWithPreference,
  };
}

/** Map employeeId|yyyy-mm-dd → preference status when worker submitted one for that day. */
export function preferenceLookupFromDocs(prefs: unknown[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const raw of prefs) {
    const p = raw as PrefDocLike;
    if (!p.employeeId || !Array.isArray(p.days)) continue;
    if (p.status !== "submitted") continue;
    for (const d of p.days) {
      if (!d.workDate || !d.preference) continue;
      m.set(`${p.employeeId}|${d.workDate}`, d.preference);
    }
  }
  return m;
}

/**
 * Days the employee submitted keep that status. The filler (mock or model) only covers days with no submission.
 * Office on Friday/Saturday stays with the filler unless weekend office is explicitly allowed, so the batch is not rejected.
 */
export function applySubmittedPreferencesToRecommendations<
  T extends { employeeId: string; date: string; recommendedStatus: string }
>(
  recommendations: T[],
  prefLookup: Map<string, string>,
  options?: { allowFridaySaturdayOffice?: boolean }
): T[] {
  const allowWeekendOffice = options?.allowFridaySaturdayOffice === true;
  return recommendations.map((row) => {
    const pref = prefLookup.get(`${row.employeeId}|${row.date}`);
    if (!pref || pref === row.recommendedStatus || !SUBMITTED_PREFERENCE_STATUSES.has(pref)) return row;
    if (pref === "office" && !allowWeekendOffice && isUtcFridayOrSaturday(row.date)) return row;
    return { ...row, recommendedStatus: pref };
  });
}

export function summarizePreferenceVsRecommendations(
  recommendations: Array<{ employeeId: string; date: string; recommendedStatus: string }>,
  prefLookup: Map<string, string>
) {
  let matchedPreference = 0;
  let differsFromPreference = 0;
  let noSubmittedPreferenceForSlot = 0;
  const differsSamples: Array<{
    employeeId: string;
    date: string;
    submittedPreference: string;
    recommendedStatus: string;
  }> = [];

  for (const r of recommendations) {
    const key = `${r.employeeId}|${r.date}`;
    const pref = prefLookup.get(key);
    if (!pref) {
      noSubmittedPreferenceForSlot++;
      continue;
    }
    if (pref === r.recommendedStatus) matchedPreference++;
    else {
      differsFromPreference++;
      if (differsSamples.length < 15) {
        differsSamples.push({
          employeeId: r.employeeId,
          date: r.date,
          submittedPreference: pref,
          recommendedStatus: r.recommendedStatus,
        });
      }
    }
  }

  return {
    recommendationRows: recommendations.length,
    matchedPreference,
    differsFromPreference,
    noSubmittedPreferenceForSlot,
    differsSamples,
  };
}
