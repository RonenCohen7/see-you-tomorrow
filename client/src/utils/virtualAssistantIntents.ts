import type { TFunction } from "i18next";
import type { AxiosInstance } from "axios";
import type { Role } from "../types/models";
import {
  normalizeAssistantText,
  parseWorkDateIsoOrDefault,
  phraseDetached,
  paddedTokenSearchSpace,
  resolveDepartmentFromText,
} from "./assistantQueryParse";
import type { BuiltinScheduleStatus } from "./virtualAssistantQueries";
import {
  queryCountEmployeesByScheduleStatus,
  queryDepartmentVacationCount,
  queryManagerLeastOfficeDays,
} from "./virtualAssistantQueries";

export type DepartmentShortcut = { id: string; name: string };

export type ClassifiedAssistantIntent =
  | { kind: "help-screen" }
  | { kind: "nav"; to: string }
  | { kind: "explain"; msgKey: string }
  | {
      kind: "query-count-status";
      dateIso: string;
      mode: "all" | "single";
      single?: BuiltinScheduleStatus | "custom:any";
    }
  | { kind: "query-dept-vacation"; dateIso: string; department: DepartmentShortcut }
  | { kind: "query-manager-least-office"; weekAnchorIso: string }
  | { kind: "clarify"; msgKey: string }
  | { kind: "unknown" };

function adminPaths(): readonly string[] {
  return ["/employees", "/departments", "/locations", "/scheduling-rules"];
}

function managerPaths(): readonly string[] {
  return ["/schedules", "/parking", "/ai"];
}

function canOpenPath(path: string, role: Role): boolean {
  if (adminPaths().includes(path)) return role === "admin";
  if (managerPaths().includes(path)) return role === "admin" || role === "manager";
  if (
    path === "/preference-ai-queue" ||
    path === "/team-preferences" ||
    path === "/reports"
  ) {
    return role === "admin" || role === "manager";
  }
  return true;
}

type NavCandidate = {
  paths: readonly string[];
  test: RegExp;
};

/** Order matters — first regex wins; first reachable path wins. */
function navTable(): NavCandidate[] {
  return [
    { paths: ["/dashboard"], test: /\b(?:דשבורד|לוח\s*הבקרה|dashboard)\b/u },
    { paths: ["/calendar"], test: /\b(?:יומן|לוח\s*שנה|calendar)\b/u },
    {
      paths: ["/schedules"],
      test: /\b(?:לוח\s*משמרות|סידורים|משמרות|\bschedules\b|weekly\s*grid)\b/u,
    },
    { paths: ["/employees"], test: /\b(?:עובדים|employees)\b/u },
    { paths: ["/departments"], test: /\b(?:מחלקות|departments)\b/u },
    { paths: ["/locations"], test: /\b(?:מיקומים|locations\b|sites)\b/u },
    {
      paths: ["/meeting-rooms"],
      test: /\b(?:חדרי\s*ישיבות|meeting\s*rooms?)\b/u,
    },
    {
      paths: ["/preferences"],
      test: /\b(?:העדפת\s*נוכחות\s*שלי|ההעדפות\s*שלי|preferences\s*mine|my\s+attendance\s+prefs)\b/u,
    },
    { paths: ["/profile"], test: /\b(?:פרופיל|profile)\b/u },
    { paths: ["/settings"], test: /\b(?:הגדרות|settings)\b/u },
    { paths: ["/notifications"], test: /\b(?:התראות|notifications)\b/u },
    { paths: ["/reports"], test: /\b(?:דוחות|reports)\b/u },
    {
      paths: ["/ai"],
      test: /\b(?:המלצות|בינה|smart\s+suggestions|\bai\b\s+(?:פתח)?\s*(?:דף)?)\b/u,
    },
    { paths: ["/parking"], test: /\b(?:חניה|parking)\b/u },
    {
      paths: ["/team-preferences"],
      test: /\b(?:העדפות\s*צוות|team\s+(?:preference|prefs))\b/u,
    },
  ];
}

export function whitelistNavPaths(): string[] {
  return [...new Set(navTable().flatMap((r) => [...r.paths]))];
}

function sniffNavigation(norm: string, role: Role): ClassifiedAssistantIntent | null {
  const whitelist = new Set(whitelistNavPaths());

  const openVerb =
    /\b(?:פתח|נווט|כנס\s+ל|קח\s+אותי|צא\s+לי|להגיע\s+ל|goto|jump\s+to|show\s+me|take\s+me|open\b)/u.test(
      norm,
    ) || norm.startsWith("/");
  const whereLike =
    /\b(?:איפה|where(?:\s+is|\s+do|\s+can|\s+'?s\b)|how\s+(?:can|do)\s+i\s+open)\b/u.test(norm);

  const maybePathSlash = norm.match(/(?:^|[\s,])(\/[a-z0-9/-]+)\b/);
  if (maybePathSlash) {
    const target = (maybePathSlash[1].split(/[?#]/)[0] ?? "") as string;
    const path = target;
    if (!whitelist.has(path)) return null;
    if (canOpenPath(path, role)) return { kind: "nav", to: path };
    return { kind: "clarify", msgKey: "assistantNavForbidden" };
  }

  if (!openVerb && !whereLike) return null;

  for (const row of navTable()) {
    if (row.test.test(norm)) {
      for (const p of row.paths) {
        if (canOpenPath(p, role)) return { kind: "nav", to: p };
      }
      return { kind: "clarify", msgKey: "assistantNavForbidden" };
    }
  }
  return null;
}

function sniffManagerLeastOffice(norm: string): boolean {
  const hasBoss =
    /(^|\s)(מנהלים|מנהל)([\s?؟,.!]|$)/u.test(norm) ||
    /\bmanagers?\b|\bmanager\b|\bboss(es)?\b/i.test(norm);
  const office = hasOfficeStatusCue(norm);
  const wantsMin =
    /(^|\s)(הכי\s*פחות|הכי\s*מעט|פחות\s*מכולם)([\s?؟]|$)/u.test(norm) ||
    /\bleast\b|\bfewest\b|\bminimum\b|\blowest\b/i.test(norm);
  return hasBoss && office && wantsMin;
}

/** חופשה / וואקישן — אל תסתמכו על \b בעברית */
function sniffVacationWord(norm: string): boolean {
  return (
    /\bpto\b(?=\s|$)/i.test(norm) ||
    /\bvacations?\b/i.test(norm) ||
    /חופשה/u.test(norm)
  );
}

function sniffDeptCue(norm: string): boolean {
  const p = paddedTokenSearchSpace(norm);
  return (
    /\bdepartments?\b|\bdept\b/i.test(norm) ||
    p.includes(" מחלקה ") ||
    p.includes(" מחלקת ") ||
    p.includes(" מחלקות ") ||
    /במחלקת\s/u.test(norm) ||
    /מהמחלקה/u.test(norm)
  );
}

function hasHowManyHe(norm: string): boolean {
  const p = paddedTokenSearchSpace(norm);
  const t = norm.trim();
  if (/^כמה(?=[\s'?,"״]|$)/u.test(t)) return true;
  if (/\sכמה\s/u.test(p)) return true;
  if (/\bמה\s+(?:נמנה|המניין|הכמות|הספירה)\b/isu.test(norm)) return true;
  return false;
}

/** שאלה כמותית או משפט "משובצים …" גם כשאין "כמה" */
function sniffCountableOrAssignment(norm: string): boolean {
  if (/\bhow\s+many\b|\bemployee\s*(count|counts)\b/is.test(norm)) return true;
  if (hasHowManyHe(norm)) return true;

  const p = paddedTokenSearchSpace(norm.trim());
  if (/\b(?:count|counts)\s+how\s+many\b/i.test(norm)) return true;

  if (/(^|\s)משובצים([\s?؟.,!]|$)/u.test(norm.trim()) || p.includes(" משובצים "))
    return true;
  if (/(^|\s)משובץ([\s?؟.,!]|$)/u.test(norm.trim()) || p.includes(" משובץ ")) return true;
  /** " מה יש בשיבוצים של … " */
  if (/(מה|איזה|אילו).*עובדי|עובדי.*(במשרד|בבית|חופשה)/isu.test(norm)) return true;

  if (p.includes(" עובדים ") && (hasHomeStatusCue(norm) || hasOfficeStatusCue(norm) || sniffVacationWord(norm)))
    return true;
  if (p.includes(" נמצאים ") && (hasHomeStatusCue(norm) || hasOfficeStatusCue(norm) || sniffVacationWord(norm)))
    return true;

  if (
    /שיבוצים|משמרות|סטטוס|נוכחות/u.test(norm) &&
    (hasHomeStatusCue(norm) || hasOfficeStatusCue(norm) || sniffVacationWord(norm)) &&
    /\d{4}-\d{2}-\d{2}|היום|מחר|אתמול/u.test(norm)
  )
    return true;

  return false;
}

function wantsAllStatuses(norm: string): boolean {
  const p = paddedTokenSearchSpace(norm);
  return (
    phraseDetached(norm, "כל הסטטוסים") ||
    /\bכל\s+(?:סוגי\s+סטטוסים|סטטוסים|סטטוס)\b/isu.test(norm) ||
    (p.includes(" כל ") && /סטטוסים/u.test(norm)) ||
    /\bbreak\s*down\b|\bstatus\s*counts\b|\ball\s+(?:assignment|schedule)\b/i.test(norm) ||
    /פירוט|לפי\s*סטטוס/isu.test(norm)
  );
}

function wantsCustom(norm: string): boolean {
  return /\bcustom\b|מותאמים|ארגון|מותאם/u.test(norm);
}

function hasHomeStatusCue(norm: string): boolean {
  if (/\bhome\b|\bwfh\b|\bremote\b/i.test(norm)) return true;
  return (
    /(^|\s)(מהבית|עבודה\s*מהבית|בבית)([\s?؟,.!;:]|$)/u.test(norm) ||
    phraseDetached(norm, "מהבית") ||
    phraseDetached(norm, "בבית")
  );
}

function hasOfficeStatusCue(norm: string): boolean {
  if (/\boffice\b|\bonsite\b/i.test(norm)) return true;
  return (
    /(^|\s)(במשרד|באופיס|משרדי|משרד|אופיס)([\s?؟.,!;:]|$)/u.test(norm) ||
    phraseDetached(norm, "במשרד")
  );
}

/** Vacation phrasing resolved only when dept cues are absent and dept name substring doesn't match roster. */
function detectSingleBuiltinStatusSafe(
  norm: string,
  departments: readonly DepartmentShortcut[],
): BuiltinScheduleStatus | undefined {
  if (hasHomeStatusCue(norm)) return "home";
  if (hasOfficeStatusCue(norm)) return "office";
  if (/(^|\s)(מחלה|חולה|\bsicks?)([\s?؟.,!]|$)/iu.test(norm)) return "sick";
  if (/day\s+off|(^|\s)(יום\s*חופש|יום\s*דילוג|דילוג)([\s?؟]|$)/iu.test(norm)) return "off";
  const deptHit = resolveDepartmentFromText(norm, departments);
  if (sniffVacationWord(norm) && !sniffDeptCue(norm) && !deptHit) {
    return "vacation";
  }
  return undefined;
}

function sniffExplain(norm: string): ClassifiedAssistantIntent | null {
  const tnorm = norm.trim();
  if (/^(שלום|היי|הי(?=[\s?؟,!]|$)|hello\b|hi\b)/iu.test(tnorm)) {
    return { kind: "explain", msgKey: "assistantExplainGreeting" };
  }
  if (
    /^מה\s+את(?:ה)?\s+יכול|^מה\s+אפשר\s+לבקש|^תסביר(?:\s+לי)?|^מה\s+ה(?:יכולות|features)\b/isu.test(
      tnorm,
    )
  ) {
    return { kind: "explain", msgKey: "assistantExplainCapabilities" };
  }
  return null;
}

function tryCountIntent(
  norm: string,
  departments: readonly DepartmentShortcut[],
): ClassifiedAssistantIntent | null {
  if (!sniffCountableOrAssignment(norm)) return null;
  /** Explicit department+vacation still handled earlier */
  if (sniffDeptCue(norm) && resolveDepartmentFromText(norm, departments)) return null;
  const dateIso = parseWorkDateIsoOrDefault(norm);
  const all = wantsAllStatuses(norm);
  if (wantsCustom(norm)) {
    return { kind: "query-count-status", dateIso, mode: "single", single: "custom:any" };
  }
  const single = detectSingleBuiltinStatusSafe(norm, departments);
  if (all || single === undefined) {
    return { kind: "query-count-status", dateIso, mode: "all" };
  }
  return { kind: "query-count-status", dateIso, mode: "single", single };
}

export function classifyAssistantMessage(
  raw: string,
  departments: readonly DepartmentShortcut[],
  role: Role,
): ClassifiedAssistantIntent {
  const norm = normalizeAssistantText(raw);
  if (norm.length < 2) return { kind: "unknown" };

  const helpTriggers =
    /עזרה\s+(?:עם\s+)?(?:מה\s+|ל\s+)?מסך|עזרה\s+(?:עם\s+)?ה(?:סרגל|מסך|ניווט\s+ומסך)|במסך\s+הזה|מה\s+במסך|מה\s+(?:לא|בא)\s+(?:מתאים\s+)?למסך|screen\s+help|help\s+with\s+(?:the\s+)?screen\b|(?:נעזור|מדריך)\s+(?:עם\s+)?המסך/isu;

  if (helpTriggers.test(norm)) return { kind: "help-screen" };

  const navigated = sniffNavigation(norm, role);
  if (navigated) return navigated;

  const explain = sniffExplain(norm);
  if (explain) return explain;

  if (sniffManagerLeastOffice(norm)) {
    const iso = parseWorkDateIsoOrDefault(norm);
    return { kind: "query-manager-least-office", weekAnchorIso: iso };
  }

  const deptResolved = resolveDepartmentFromText(norm, departments);

  if (sniffVacationWord(norm) && deptResolved) {
    const dateIso = parseWorkDateIsoOrDefault(norm);
    return { kind: "query-dept-vacation", dateIso, department: deptResolved };
  }

  if (sniffVacationWord(norm) && sniffDeptCue(norm) && !deptResolved) {
    return { kind: "clarify", msgKey: "assistantAskDeptName" };
  }

  const countHit = tryCountIntent(norm, departments);
  if (countHit) return countHit;

  return { kind: "unknown" };
}

export async function fulfillAssistantIntent(
  intent: Exclude<ClassifiedAssistantIntent, { kind: "nav" } | { kind: "help-screen" }>,
  ctx: { client: AxiosInstance; t: TFunction; role: Role },
): Promise<string> {
  switch (intent.kind) {
    case "explain":
      return ctx.t(intent.msgKey);
    case "clarify":
      return ctx.t(intent.msgKey);

    case "unknown":
      return ctx.t("assistantUnknown");

    case "query-count-status": {
      if (intent.mode === "all") {
        return queryCountEmployeesByScheduleStatus({
          client: ctx.client,
          t: ctx.t,
          dateIso: intent.dateIso,
        });
      }
      return queryCountEmployeesByScheduleStatus({
        client: ctx.client,
        t: ctx.t,
        dateIso: intent.dateIso,
        singleStatus: intent.single,
      });
    }
    case "query-dept-vacation":
      return queryDepartmentVacationCount({
        client: ctx.client,
        t: ctx.t,
        dateIso: intent.dateIso,
        departmentId: intent.department.id,
        departmentName: intent.department.name,
      });
    case "query-manager-least-office":
      return queryManagerLeastOfficeDays({
        client: ctx.client,
        t: ctx.t,
        role: ctx.role,
        weekAnchorIso: intent.weekAnchorIso,
      });
    default:
      return ctx.t("assistantUnknown");
  }
}
