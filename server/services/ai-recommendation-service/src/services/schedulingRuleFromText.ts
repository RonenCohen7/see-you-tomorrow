import OpenAI from "openai";
import { SCHEDULING_RULE_TYPES } from "@syt/shared";
import { z } from "zod";

const OutSchema = z.object({
  ruleType: z.enum(SCHEDULING_RULE_TYPES as unknown as [string, ...string[]]),
  payload: z.record(z.unknown()),
  explanationHebrew: z.string(),
});

export type SchedulingRuleDraftResult = z.infer<typeof OutSchema>;

export async function interpretSchedulingRuleFromText(input: {
  naturalText: string;
  locations: Array<{ id: string; name: string }>;
}): Promise<{ ok: true; draft: SchedulingRuleDraftResult } | { ok: false; error: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "אין OPENAI_API_KEY בשרת — לא ניתן לנתח חוק מטקסט חופשי. השתמשו בטפסים למטה או הגדרו מפתח.",
    };
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const sys = [
    "You draft ONE workforce scheduling-rule object for Israeli workplace admin UI.",
    "Rule types:",
    `- location_unavailable: payload { locationId (24-char hex OBJECT ID from supplied locations[] only), effectiveFrom YYYY-MM-DD, effectiveTo optional YYYY-MM-DD, note optional }`,
    `- min_managers_office_daily: payload { minManagers number 0-50 }`,
    `- manager_office_auto_parking: payload must be {} (empty object — auto parking hook at office rows)`,
    "Match user intent to ONE rule type. Prefer location_unavailable if they mention closure/sick-building/unavailable-site/dates tied to ONE site.",
    "Never invent locationId values outside the supplied locations[].id list.",
    "Output ONLY JSON: { ruleType, payload, explanationHebrew } matching schema.",
  ].join("\n");

  const user = JSON.stringify({
    instruction: input.naturalText.trim(),
    locations: input.locations,
  });

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "תשובת המודל אינה JSON תקף — נסו ניסוח אחר או טפסים ידניים." };
  }

  const safe = OutSchema.safeParse(parsed);
  if (!safe.success) {
    return {
      ok: false,
      error:
        typeof (parsed as { explanationHebrew?: unknown })?.explanationHebrew === "string"
          ? String((parsed as { explanationHebrew: string }).explanationHebrew)
          : "לא ניתן למפות את הבקשה לחוק מובנה.",
    };
  }

  const d = safe.data;
  if (d.ruleType === "min_managers_office_daily") {
    const n = d.payload.minManagers;
    if (typeof n !== "number" || n < 0 || n > 50) {
      return { ok: false, error: "מספר מנהלים מינימלי לא תקין בתשובת המודל." };
    }
  }

  if (d.ruleType === "manager_office_auto_parking") {
    if (Object.keys(d.payload).length > 0) {
      return { ok: false, error: "חוק התנהגות צריך payload ריק במערכת — ניסו שנית עם ניסוח פשוט יותר." };
    }
  }

  const allowedIds = new Set(input.locations.map((l) => l.id));
  if (d.ruleType === "location_unavailable") {
    const lid = typeof d.payload.locationId === "string" ? d.payload.locationId : "";
    if (!/^[a-f\d]{24}$/i.test(lid) || !allowedIds.has(lid)) {
      return {
        ok: false,
        error:
          'חובה לבחור מיקום קיים מתוך הרשימה. נסו להזכיר שם העסק במדויק או הקלידו בטופס "מיקום לא זמין" למטה.',
      };
    }
  }

  return { ok: true, draft: d };
}
