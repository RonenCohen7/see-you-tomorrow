import type Anthropic from "@anthropic-ai/sdk";

type Tool = Anthropic.Tool;
import {
  fetchActiveEmployees,
  fetchDepartments,
  fetchLocations,
  fetchSchedulingRules,
  checkSchedulingRuleConflicts,
  submitSchedulingRule,
  fetchScheduleDay,
  fetchScheduleWeek,
  type ScheduleRow,
} from "./assistantApiClient.js";
import { interpretSchedulingRuleFromText } from "./schedulingRuleFromText.js";

const BUILTIN_STATUSES = ["office", "home", "vacation", "sick", "off"] as const;

function uniqueByStatus(items: ScheduleRow[]) {
  const map = new Map<string, Set<string>>();
  for (const row of items) {
    if (!map.has(row.status)) map.set(row.status, new Set());
    map.get(row.status)!.add(row.employeeId);
  }
  const out: Record<string, number> = {};
  for (const [status, set] of map) {
    out[status] = set.size;
  }
  for (const b of BUILTIN_STATUSES) {
    if (!(b in out)) out[b] = 0;
  }
  let custom = 0;
  const customSeen = new Set<string>();
  for (const row of items) {
    if (!row.status.startsWith("custom:")) continue;
    customSeen.add(row.employeeId);
  }
  custom = customSeen.size;
  if (custom > 0) out.custom = custom;
  return out;
}

export const ASSISTANT_TOOL_DEFINITIONS: Tool[] = [
  {
    name: "schedule_day_summary",
    description:
      "Count unique employees per schedule status on a single calendar day (YYYY-MM-DD). Respects user permissions.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "ISO date YYYY-MM-DD" },
        status_filter: {
          type: "string",
          description: "Optional: office | home | vacation | sick | off | custom",
        },
      },
      required: ["date"],
    },
  },
  {
    name: "schedule_week_office_days",
    description:
      "For each manager (role=manager), count distinct days with office status in the week containing anchor_date. Returns week range and leaderboard.",
    input_schema: {
      type: "object",
      properties: {
        anchor_date: { type: "string", description: "Any date in the week, YYYY-MM-DD" },
      },
      required: ["anchor_date"],
    },
  },
  {
    name: "department_vacation_count",
    description:
      "Count unique employees on vacation on a date who belong to a department (by roster departmentId).",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string" },
        department_id: { type: "string" },
      },
      required: ["date", "department_id"],
    },
  },
  {
    name: "list_departments",
    description: "List departments visible to the user (id and name).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "resolve_department",
    description: "Find best-matching department by partial name (Hebrew or English).",
    input_schema: {
      type: "object",
      properties: {
        name_query: { type: "string" },
      },
      required: ["name_query"],
    },
  },
  {
    name: "navigate_hint",
    description:
      "Suggest an in-app route path for the client to open. Only use paths from the system map.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "e.g. /schedules, /calendar" },
        reason: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "list_scheduling_rules",
    description: "List organization scheduling rules (admin). Returns rule types and summaries.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "draft_scheduling_rule",
    description:
      "Parse natural language into a structured scheduling rule draft (admin). Requires locations list from server.",
    input_schema: {
      type: "object",
      properties: {
        natural_text: { type: "string", description: "User description of the desired rule" },
      },
      required: ["natural_text"],
    },
  },
  {
    name: "check_scheduling_rule_conflicts",
    description: "Check if a rule draft conflicts with active rules (admin).",
    input_schema: {
      type: "object",
      properties: {
        rule_type: {
          type: "string",
          enum: ["location_unavailable", "min_managers_office_daily", "manager_office_auto_parking"],
        },
        payload: { type: "object" },
        is_active: { type: "boolean" },
      },
      required: ["rule_type", "payload"],
    },
  },
  {
    name: "submit_scheduling_rule",
    description:
      "Save rule if no conflict, else create pending proposal for manager approval (admin). Include explanations from draft.",
    input_schema: {
      type: "object",
      properties: {
        rule_type: { type: "string" },
        payload: { type: "object" },
        is_active: { type: "boolean" },
        explanation_hebrew: { type: "string" },
        explanation_en: { type: "string" },
      },
      required: ["rule_type", "payload"],
    },
  },
];

const ALLOWED_NAV_PATHS = new Set([
  "/dashboard",
  "/calendar",
  "/meeting-rooms",
  "/preferences",
  "/employees",
  "/departments",
  "/locations",
  "/scheduling-rules",
  "/schedules",
  "/team-preferences",
  "/preference-ai-queue",
  "/parking",
  "/reports",
  "/ai",
  "/notifications",
  "/profile",
  "/settings",
]);

function normalizeDeptQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/\s*(מהמחלקה|במחלקת|מחלקת|מחלקה|department)s?\s*/giu, " ")
    .replace(/\s+/g, " ");
}

function resolveDeptByName(
  items: Array<{ id: string; name: string }>,
  query: string,
): { id: string; name: string } | null {
  const q = normalizeDeptQuery(query);
  if (!q) return null;
  let best: { id: string; name: string } | null = null;
  let bestLen = 0;
  for (const d of items) {
    const n = normalizeDeptQuery(d.name);
    if (n.length < 2) continue;
    if (q.includes(n) || n.includes(q)) {
      if (n.length > bestLen) {
        bestLen = n.length;
        best = d;
      }
    }
  }
  return best;
}

export type ToolRunResult = {
  json: string;
  navigateTo?: string;
};

function requireAdmin(role: string) {
  if (role !== "admin") {
    throw new Error("admin_only: scheduling rule tools require admin role");
  }
}

export async function runAssistantTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { authHeader: string; role: string; locale: "he" | "en" },
): Promise<ToolRunResult> {
  const { authHeader, role, locale } = ctx;
  switch (name) {
    case "schedule_day_summary": {
      const date = String(input.date ?? "");
      const filter = input.status_filter ? String(input.status_filter) : undefined;
      const { date: resolvedDate, items } = await fetchScheduleDay(authHeader, date);
      const counts = uniqueByStatus(items);
      if (filter && filter !== "custom") {
        const n = counts[filter] ?? 0;
        return {
          json: JSON.stringify({ date: resolvedDate, status: filter, unique_employees: n }),
        };
      }
      if (filter === "custom") {
        return {
          json: JSON.stringify({
            date: resolvedDate,
            status: "custom",
            unique_employees: counts.custom ?? 0,
          }),
        };
      }
      return { json: JSON.stringify({ date: resolvedDate, counts_by_status: counts }) };
    }

    case "schedule_week_office_days": {
      const anchor = String(input.anchor_date ?? "");
      const [{ start, end, schedules }, employees] = await Promise.all([
        fetchScheduleWeek(authHeader, anchor),
        fetchActiveEmployees(authHeader),
      ]);
      const managers = employees.filter((e) => e.role === "manager");
      const officeDays = new Map<string, Set<string>>();
      for (const m of managers) {
        officeDays.set(m.id, new Set());
      }
      for (const row of schedules) {
        if (row.status !== "office") continue;
        const set = officeDays.get(row.employeeId);
        if (set) set.add(row.workDate);
      }
      const rows = managers.map((m) => ({
        employee_id: m.id,
        full_name: m.fullName,
        office_days: officeDays.get(m.id)?.size ?? 0,
      }));
      rows.sort((a, b) => a.office_days - b.office_days || a.full_name.localeCompare(b.full_name));
      const min = rows.length ? rows[0]!.office_days : 0;
      const least = rows.filter((r) => r.office_days === min);
      return {
        json: JSON.stringify({
          week: { start, end },
          managers: rows,
          fewest_office_days: least,
          fewest_count: min,
        }),
      };
    }

    case "department_vacation_count": {
      const date = String(input.date ?? "");
      const departmentId = String(input.department_id ?? "");
      const [day, employees, depts] = await Promise.all([
        fetchScheduleDay(authHeader, date),
        fetchActiveEmployees(authHeader),
        fetchDepartments(authHeader),
      ]);
      const inDept = new Set(
        employees.filter((e) => e.departmentId === departmentId).map((e) => e.id),
      );
      const seen = new Set<string>();
      for (const row of day.items) {
        if (row.status !== "vacation") continue;
        if (!inDept.has(row.employeeId)) continue;
        seen.add(row.employeeId);
      }
      const deptName = depts.items.find((d) => d.id === departmentId)?.name ?? departmentId;
      return {
        json: JSON.stringify({
          date: day.date,
          department_id: departmentId,
          department_name: deptName,
          unique_on_vacation: seen.size,
        }),
      };
    }

    case "list_departments": {
      const data = await fetchDepartments(authHeader);
      const items = data.items
        .filter((d) => d.name?.trim() && (d.isActive ?? true))
        .map((d) => ({ id: d.id, name: d.name }));
      return { json: JSON.stringify({ departments: items }) };
    }

    case "resolve_department": {
      const data = await fetchDepartments(authHeader);
      const items = data.items.filter((d) => d.name?.trim());
      const match = resolveDeptByName(items, String(input.name_query ?? ""));
      return {
        json: JSON.stringify(
          match
            ? { found: true, id: match.id, name: match.name }
            : { found: false, hint: "Ask user to clarify department name" },
        ),
      };
    }

    case "navigate_hint": {
      const path = String(input.path ?? "").split(/[?#]/)[0] ?? "";
      if (!ALLOWED_NAV_PATHS.has(path)) {
        return {
          json: JSON.stringify({ ok: false, error: "path_not_allowed", path }),
        };
      }
      return {
        json: JSON.stringify({
          ok: true,
          path,
          reason: input.reason ? String(input.reason) : undefined,
        }),
        navigateTo: path,
      };
    }

    case "list_scheduling_rules": {
      requireAdmin(role);
      const [items, locs] = await Promise.all([
        fetchSchedulingRules(authHeader),
        fetchLocations(authHeader),
      ]);
      return {
        json: JSON.stringify({
          rules: items.items,
          locations_for_reference: (locs.items ?? []).map((l) => ({ id: l.id, name: l.name })),
        }),
      };
    }

    case "draft_scheduling_rule": {
      requireAdmin(role);
      const locs = await fetchLocations(authHeader);
      const locations = (locs.items ?? [])
        .filter((l) => l.name?.trim())
        .map((l) => ({ id: l.id, name: l.name }));
      const result = await interpretSchedulingRuleFromText({
        naturalText: String(input.natural_text ?? ""),
        locations,
      });
      return { json: JSON.stringify(result) };
    }

    case "check_scheduling_rule_conflicts": {
      requireAdmin(role);
      const locs = await fetchLocations(authHeader);
      const data = await checkSchedulingRuleConflicts(authHeader, {
        ruleType: String(input.rule_type ?? ""),
        payload: (input.payload as Record<string, unknown>) ?? {},
        isActive: input.is_active !== false,
        locations: (locs.items ?? []).map((l) => ({ id: l.id, name: l.name })),
        locale,
      });
      return { json: JSON.stringify(data) };
    }

    case "submit_scheduling_rule": {
      requireAdmin(role);
      const locs = await fetchLocations(authHeader);
      const data = await submitSchedulingRule(authHeader, {
        ruleType: String(input.rule_type ?? ""),
        payload: (input.payload as Record<string, unknown>) ?? {},
        isActive: input.is_active !== false,
        explanationHe: String(input.explanation_hebrew ?? input.explanation_he ?? ""),
        explanationEn: input.explanation_en ? String(input.explanation_en) : undefined,
        locations: (locs.items ?? []).map((l) => ({ id: l.id, name: l.name })),
      });
      return { json: JSON.stringify(data) };
    }

    default:
      return { json: JSON.stringify({ error: `unknown_tool:${name}` }) };
  }
}
