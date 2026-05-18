import { addDaysIsoLocal, todayIsoLocal } from "./date";

const ISO_DATE_RE = /20\d{2}-\d{2}-\d{2}/;

/**
 * Pads text so we can mimic word boundaries — JS `\b` is ASCII `\w`-only,
 * so it never anchors Hebrew phrases like "כמה … היום" correctly.
 */
export function paddedTokenSearchSpace(textNormalized: string): string {
  return ` ${textNormalized.trim().replace(/\s+/g, " ")} `;
}

/** True if phrase appears detached (not glued into a longer Hebrew word via missing spaces). */
export function phraseDetached(textNormalized: string, phrase: string): boolean {
  if (!phrase.trim()) return false;
  const q = paddedTokenSearchSpace(textNormalized);
  const p = ` ${phrase.trim().replace(/\s+/g, " ")} `;
  return q.includes(p);
}

/** Lowercase-ish + strip extra spaces + normalize quotes for fuzzy match */
export function normalizeAssistantText(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[""״']/g, "'")
    .toLowerCase();
}

export interface ParsedRelativeDate {
  /** Local calendar YYYY-MM-DD */
  iso: string;
}

/**
 * Finds first ISO literal or maps relative words (Hebrew + English).
 * If nothing matches returns null → caller should ask for clarification.
 */
export function parseWorkDateIso(textNormalized: string): ParsedRelativeDate | null {
  const lit = textNormalized.match(ISO_DATE_RE);
  if (lit) return { iso: lit[0] };

  if (
    phraseDetached(textNormalized, "היום") ||
    /(ביום הנוכחי|במהלך\s*היום|ביום זה)/u.test(textNormalized) ||
    /\btoday\b/i.test(textNormalized)
  ) {
    return { iso: todayIsoLocal() };
  }
  if (phraseDetached(textNormalized, "מחר") || /\btomorrow\b/i.test(textNormalized)) {
    return { iso: addDaysIsoLocal(todayIsoLocal(), 1) };
  }
  if (phraseDetached(textNormalized, "אתמול") || /\byesterday\b/i.test(textNormalized)) {
    return { iso: addDaysIsoLocal(todayIsoLocal(), -1) };
  }

  return null;
}

/** When user omits תאריך (common in Hebrew) default to today's local ISO. */
export function parseWorkDateIsoOrDefault(textNormalized: string): string {
  return parseWorkDateIso(textNormalized)?.iso ?? todayIsoLocal();
}

export interface DepartmentCandidate {
  id: string;
  name: string;
}

/**
 * Scrubs known noise tokens so "מחלקת RnD" compares better against "RnD".
 */
function stripNoiseForDeptMatch(norm: string): string {
  /** Avoid `\b` — Hebrew tokens */
  return norm
    .replace(/\s*(מהמחלקה|במחלקות|במחלקת|מחלקות|מחלקת|מחלקה|departments|department)s?\s*/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Matches a department name substring after normalization; prefers longest matching name.
 */
export function resolveDepartmentFromText(
  rawNormalized: string,
  departments: readonly DepartmentCandidate[],
): DepartmentCandidate | null {
  const deptNorms = departments
    .filter((d) => d.name.trim().length >= 2)
    .map((d) => ({
      d,
      n: normalizeAssistantText(stripNoiseForDeptMatch(d.name)),
    }))
    .filter((x) => x.n.length >= 2);

  const fuzzy = normalizeAssistantText(stripNoiseForDeptMatch(rawNormalized));
  let best: DepartmentCandidate | null = null;
  let bestLen = 0;

  for (const { d, n } of deptNorms) {
    if (fuzzy.includes(n) || n.includes(fuzzy)) {
      const len = n.length;
      if (len > bestLen) {
        bestLen = len;
        best = d;
      }
    }
  }

  return best;
}
