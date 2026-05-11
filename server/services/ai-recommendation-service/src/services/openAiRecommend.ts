import OpenAI from "openai";
import { z } from "zod";
import { SCHEDULE_STATUSES } from "@syt/shared";

const OutSchema = z.object({
  recommendations: z.array(
    z.object({
      date: z.string(),
      employeeId: z.string(),
      recommendedStatus: z.enum(SCHEDULE_STATUSES as unknown as [string, ...string[]]),
      reason: z.string(),
    })
  ),
  confidence: z.number().min(0).max(1).optional(),
});

export async function generateRecommendationsPrompt(payload: {
  departmentId: string;
  locationId: string;
  dateRange: { from: string; to: string };
  constraints?: Record<string, unknown>;
  employees: Array<{ id: string; fullName: string }>;
  capacity?: number;
  historicalSummaries: unknown;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return mockRecommendations(payload);
  }

  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a workforce scheduling assistant. Output ONLY valid JSON matching the schema: { recommendations: [{ date, employeeId, recommendedStatus, reason }], confidence?: number }. Status must be one of: office, home, vacation, sick, off. Balance office presence with capacity and fairness.",
      },
      {
        role: "user",
        content: JSON.stringify(payload),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return mockRecommendations(payload);
  }

  const safe = OutSchema.safeParse(parsed);
  if (!safe.success) {
    return mockRecommendations(payload);
  }

  return {
    recommendations: safe.data.recommendations,
    confidence: safe.data.confidence ?? 0.75,
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  };
}

function mockRecommendations(payload: {
  employees: Array<{ id: string }>;
  dateRange: { from: string; to: string };
}) {
  const recs: Array<{ date: string; employeeId: string; recommendedStatus: string; reason: string }> = [];
  const start = new Date(payload.dateRange.from);
  const end = new Date(payload.dateRange.to);
  let i = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    payload.employees.forEach((emp, idx) => {
      const office = (i + idx) % 3 !== 0;
      recs.push({
        date: iso,
        employeeId: emp.id,
        recommendedStatus: office ? "office" : "home",
        reason: "המלצה לדוגמה ללא מפתח OpenAI — הגדר OPENAI_API_KEY לפעולה מלאה.",
      });
    });
    i++;
  }
  return {
    recommendations: recs,
    confidence: 0.35,
    model: "mock-local",
  };
}
