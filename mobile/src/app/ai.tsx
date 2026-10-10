import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { t, tr } from "@/locale/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";

type Person = { id: string; fullName: string; role?: string; isActive?: boolean };
type Shift = { employeeId: string; workDate: string; status: string };
type Spot = { id: string; label: string; locationName?: string; assignedEmployeeId?: string; isActive: boolean };
type Reservation = { spotId: string; workDate: string };
type Place = { id: string; name: string };
type Severity = "error" | "warning" | "info";
type AlertItem = {
  id: string;
  severity: Severity;
  name: string;
  title: string;
  detail: string;
  color: string;
  members?: string[];
};
type Rec = { date: string; employeeId: string; recommendedStatus: string; reason?: string };
type RecommendResult = {
  recommendations: Rec[];
  confidence?: number;
  model?: string;
  validation?: { ok: true } | { ok: false; errors: string[] };
  preferenceContext?: { submittedPreferenceDocuments: number; employeesWithSubmittedPrefs: number; employeeDaysWithPreference: number };
  preferenceVsRecommendation?: {
    recommendationRows: number;
    matchedPreference: number;
    differsFromPreference: number;
    noSubmittedPreferenceForSlot: number;
  };
};

const STATUS: Record<string, string> = {
  office: "משרד",
  home: "בית",
  client: "מחוץ למשרד – לקוח",
  vacation: "חופשה",
  sick: "חופשת מחלה",
  off: "לא עובד",
};
const WEEKDAY = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];
const RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
const SEV_COLOR: Record<Severity, string> = { error: "#ef4444", warning: "#d97706", info: "#0284c7" };
const COVERAGE_ID = "manager-office-coverage-next-week";

const HOLIDAYS = [
  { id: "shavuot-2026", remindFrom: "2026-05-18", chagFirst: "2026-06-01", chagLast: "2026-06-02", name: "חג השבועות" },
  { id: "rosh-hashana-2026", remindFrom: "2026-09-19", chagFirst: "2026-10-03", chagLast: "2026-10-04", name: "ראש השנה" },
  { id: "yom-kippur-2026", remindFrom: "2026-09-28", chagFirst: "2026-10-12", chagLast: "2026-10-12", name: "יום כיפור" },
  { id: "sukkot-2026", remindFrom: "2026-10-03", chagFirst: "2026-10-17", chagLast: "2026-10-24", name: "סוכות" },
  { id: "purim-2027", remindFrom: "2027-02-28", chagFirst: "2027-03-14", chagLast: "2027-03-15", name: "פורים" },
  { id: "pesach-2027", remindFrom: "2027-03-27", chagFirst: "2027-04-10", chagLast: "2027-04-18", name: "פסח" },
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function todayIso(): string {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addLocal(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000);
}

function utcWeekday(iso: string): string {
  return t(WEEKDAY[new Date(`${iso}T12:00:00.000Z`).getUTCDay()] ?? "");
}

function nextWeekDays(): string[] {
  const now = new Date();
  const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay() + 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sunday);
    day.setUTCDate(sunday.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : t("שגיאה");
}

function statusLabel(value?: string): string {
  if (!value) return "—";
  return t(STATUS[value] ?? value);
}

function buildAlerts(people: Person[], recent: Shift[], forward: Shift[], spots: Spot[], reservations: Reservation[], today: string): AlertItem[] {
  const active = people.filter((person) => person.isActive !== false);
  const names = new Map(active.map((person) => [person.id, person.fullName]));
  const leaders = new Set(active.filter((person) => person.role === "admin" || person.role === "manager").map((person) => person.id));
  const out: AlertItem[] = [];

  const gaps = nextWeekDays().filter(
    (day) => !forward.some((row) => row.workDate === day && row.status === "office" && leaders.has(row.employeeId))
  );
  if (leaders.size > 0 && gaps.length > 0) {
    const dates = gaps.map((day) => `${day} (${utcWeekday(day)})`).join(" · ");
    out.push({
      id: COVERAGE_ID,
      severity: "error",
      name: "",
      title: t("חסרה הנהלה במשרד בימים מסוימים"),
      detail: tr(
        `הימים הבאים (שבוע א׳–ש׳ הבא) ללא שיבוץ «משרד» להנהלה: ${dates}.`,
        `These upcoming days (next Sun–Sat) have no manager assigned to the office: ${dates}.`
      ),
      color: "#b91c1c",
    });
  }

  for (const holiday of HOLIDAYS) {
    if (today < holiday.remindFrom || today > holiday.chagLast) continue;
    const before = today < holiday.chagFirst;
    out.push({
      id: `holiday-${holiday.id}`,
      severity: "info",
      name: t("לוח שנה ותכנון"),
      title: t(holiday.name),
      detail: before
        ? tr(
            `${holiday.name}: בעוד ${daysBetween(today, holiday.chagFirst)} ימים מתחיל חלון שיבוץ רגיש — כדאי לעדכן נוכחות, חניות והקצאות עד ${holiday.chagLast}.`,
            `${t(holiday.name)}: a sensitive scheduling window starts in ${daysBetween(today, holiday.chagFirst)} days — update attendance, parking, and assignments by ${holiday.chagLast}.`
          )
        : tr(
            `${holiday.name}: בתקופת החג (עד ${holiday.chagLast}) ייתכנו שינויים בשיבוצים ובחניות.`,
            `${t(holiday.name)}: during the holiday (through ${holiday.chagLast}) schedules and parking may change.`
          ),
      color: "#6d28d9",
    });
  }

  out.push({
    id: "traffic-awareness",
    severity: "info",
    name: t("תנועה וכבישים"),
    title: t("שיבושי דרכים ועומסים"),
    detail: t("בעת סגירות כבישים או עומסים — עדכנו ציפיות להגעה ושיבוצים."),
    color: "#b45309",
  });

  const byPerson = new Map<string, Shift[]>();
  for (const row of recent) {
    const list = byPerson.get(row.employeeId) ?? [];
    list.push(row);
    byPerson.set(row.employeeId, list);
  }
  const noOffice: { name: string; streak: number }[] = [];
  for (const [id, list] of byPerson) {
    const name = names.get(id);
    if (!name) continue;
    const sorted = [...list].sort((a, b) => b.workDate.localeCompare(a.workDate));
    const last14 = sorted.slice(0, 14);
    const homeDays = last14.filter((row) => row.status === "home").length;
    const vacationDays = sorted.filter((row) => row.status === "vacation").length;
    let sick = 0;
    for (const row of sorted) {
      if (row.status === "sick") sick += 1;
      else break;
    }
    let away = 0;
    for (const row of sorted) {
      if (row.status === "office") break;
      away += 1;
    }
    if (away >= 3) noOffice.push({ name, streak: away });
    if (homeDays >= 8) {
      out.push({
        id: `home-${id}`,
        severity: homeDays >= 11 ? "error" : "warning",
        name,
        title: t("יותר מדי ימי עבודה מהבית"),
        detail: tr(
          `${homeDays} מתוך 14 הימים האחרונים מהבית — מומלץ לחזור למשרד מספר ימים בשבוע.`,
          `${homeDays} of the last 14 days were at home — a few office days this week would help.`
        ),
        color: "#ea580c",
      });
    }
    if (vacationDays > 22) {
      out.push({
        id: `vac-${id}`,
        severity: "error",
        name,
        title: t("חרג ממכסת חופשה"),
        detail: tr(
          `${vacationDays} ימי חופשה ב-30 הימים האחרונים — חרג ממכסה סטנדרטית.`,
          `${vacationDays} vacation days in the last 30 days — over the usual allowance.`
        ),
        color: "#0d9488",
      });
    }
    if (sick >= 3) {
      out.push({
        id: `sick-${id}`,
        severity: sick >= 5 ? "error" : "warning",
        name,
        title: t("ימי מחלה רצופים רבים"),
        detail: tr(
          `${sick} ימי מחלה רצופים — שווה לבדוק שלום.`,
          `${sick} sick days in a row — worth checking in.`
        ),
        color: "#dc2626",
      });
    }
  }
  if (noOffice.length > 0) {
    noOffice.sort((a, b) => b.streak - a.streak || a.name.localeCompare(b.name, "he"));
    const maxStreak = Math.max(...noOffice.map((row) => row.streak));
    out.push({
      id: "noffice-group",
      severity: noOffice.length >= 8 ? "warning" : "info",
      name: tr(
        `${noOffice.length} עובדים ללא רשומת «משרד» ברצף`,
        `${noOffice.length} people with no recent office day`
      ),
      title: t("לא במשרד — רצף מהרשומות האחרונות"),
      detail: tr(
        `לפי הרשומות האחרונות יש עובדים עם ${maxStreak} ימים רצופים ומעלה ללא סטטוס משרד.`,
        `Recent records show people with ${maxStreak} or more days in a row without an office status.`
      ),
      color: "#2563eb",
      members: noOffice.map((row) => tr(`${row.name} · ${row.streak} ימים רצופים`, `${row.name} · ${row.streak} days in a row`)),
    });
  }

  const taken = new Set(reservations.map((row) => `${row.spotId}|${row.workDate}`));
  for (let offset = 0; offset <= 14; offset += 1) {
    const day = addLocal(today, offset);
    for (const spot of spots) {
      if (!spot.isActive || !spot.assignedEmployeeId) continue;
      if (taken.has(`${spot.id}|${day}`)) continue;
      const dayRows = forward.filter((row) => row.employeeId === spot.assignedEmployeeId && row.workDate === day);
      if (dayRows.length === 0 || dayRows.some((row) => row.status === "office")) continue;
      out.push({
        id: `parking-${spot.id}-${day}`,
        severity: "info",
        name: names.get(spot.assignedEmployeeId) || t("עובד"),
        title: t("חניה פנויה להקצאה"),
        detail: tr(
          `${spot.label} · ${day}${spot.locationName ? ` · ${spot.locationName}` : ""} — בעל החניה הקבוע לא משובץ למשרד.`,
          `${spot.label} · ${day}${spot.locationName ? ` · ${spot.locationName}` : ""} — the assigned owner is not scheduled in the office.`
        ),
        color: "#1565c0",
      });
    }
  }

  return out.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
}

async function loadPeople(): Promise<Person[]> {
  const all: Person[] = [];
  let page = 1;
  while (page < 20) {
    const data = await api<{ items: Person[]; total: number }>(`/api/employees?page=${page}&limit=100`);
    all.push(...data.items);
    if (all.length >= data.total || data.items.length === 0) break;
    page += 1;
  }
  return all;
}

async function weatherAlert(today: string): Promise<AlertItem | null> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", "32.0853");
    url.searchParams.set("longitude", "34.7818");
    url.searchParams.set("daily", "weathercode,precipitation_probability_max");
    url.searchParams.set("timezone", "Asia/Jerusalem");
    url.searchParams.set("forecast_days", "5");
    const response = await fetch(url.toString());
    if (!response.ok) return null;
    const data = (await response.json()) as {
      daily?: { time?: string[]; weathercode?: number[]; precipitation_probability_max?: number[] };
    };
    const times = data.daily?.time ?? [];
    const codes = data.daily?.weathercode ?? [];
    const probs = data.daily?.precipitation_probability_max ?? [];
    for (let index = 0; index < times.length; index += 1) {
      const date = times[index];
      const code = codes[index] ?? 0;
      const prob = probs[index] ?? 0;
      const rainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code === 95 || code === 96 || code === 99;
      if (!date || date < today || (!rainy && prob < 55)) continue;
      return {
        id: `weather-${date}`,
        severity: prob >= 70 || rainy ? "warning" : "info",
        name: t("מזג אוויר (תחזית)"),
        title: tr(`תשומת לב למזג — ${date}`, `Weather watch — ${date}`),
        detail: tr(
          `סיכוי לגשם ${prob}% (קוד תחזית ${code}). שקלו שיבוצי היבריד, הגעה וחניות.`,
          `${prob}% chance of rain (forecast code ${code}). Consider hybrid schedules, arrival, and parking.`
        ),
        color: "#0284c7",
      };
    }
  } catch {
    return null;
  }
  return null;
}

export default function AiScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.role?.trim().toLowerCase() === "admin";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Place[]>([]);
  const [locations, setLocations] = useState<Place[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [formOpen, setFormOpen] = useState(false);
  const [dept, setDept] = useState("");
  const [loc, setLoc] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minOffice, setMinOffice] = useState("3");
  const [cap, setCap] = useState("50");
  const [weekend, setWeekend] = useState(false);
  const [picker, setPicker] = useState<null | "dept" | "loc" | "from" | "to">(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RecommendResult | null>(null);

  const today = useMemo(() => todayIso(), []);
  const dateChoices = useMemo(() => Array.from({ length: 45 }, (_, index) => addLocal(today, index - 7)), [today]);

  const load = useCallback(async () => {
    const fromRecent = addLocal(today, -30);
    const toForward = addLocal(today, 14);
    const [people, recent, forward, spotData, resData, deptData, locData, weather] = await Promise.all([
      loadPeople(),
      api<{ items: Shift[] }>(`/api/schedules?from=${fromRecent}&to=${today}`),
      api<{ items: Shift[] }>(`/api/schedules?from=${today}&to=${toForward}`),
      api<{ items: Spot[] }>("/api/parking/spots"),
      api<{ items: Reservation[] }>(`/api/parking/reservations?from=${today}&to=${toForward}`),
      api<{ items: Place[] }>("/api/departments?isActive=true"),
      api<{ items: Place[] }>("/api/locations?isActive=true"),
      weatherAlert(today),
    ]);
    const next = buildAlerts(people, recent.items, forward.items, spotData.items, resData.items, today);
    if (weather) next.push(weather);
    next.sort((a, b) => RANK[a.severity] - RANK[b.severity]);
    setAlerts(next);
    setDepartments(deptData.items);
    setLocations(locData.items);
    setNames(new Map(people.map((person) => [person.id, person.fullName])));
    setDept((current) => current || (isAdmin ? deptData.items[0]?.id ?? "" : user?.departmentId ?? ""));
  }, [today, isAdmin, user?.departmentId]);

  useEffect(() => {
    if (status !== "signedIn" || !user || !canOpen(user.role, "ai")) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await load();
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, user, load]);

  if (status === "signedOut") return <Redirect href="/login" />;
  if (!user) return null;
  if (!canOpen(user.role, "ai")) return <Redirect href="/home" />;

  const coverage = alerts.find((item) => item.id === COVERAGE_ID);
  const deptName = departments.find((item) => item.id === dept)?.name || (isAdmin ? t("מחלקה") : t("המחלקה שלך"));
  const locName = locations.find((item) => item.id === loc)?.name || t("מיקום");

  async function recommend() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await api<RecommendResult>("/api/ai/recommend-schedule", {
        method: "POST",
        body: {
          departmentId: dept,
          locationId: loc,
          dateRange: { from, to },
          constraints: {
            minOfficeEmployeesPerDay: Number(minOffice) || 0,
            maxOfficeCapacity: Number(cap) || 0,
            preferredOfficeDays: ["Monday", "Wednesday"],
          },
          ...(isAdmin && weekend ? { allowFridaySaturdayOffice: true } : {}),
        },
      });
      setResult(data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!result) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/ai/approve-recommendations", {
        method: "POST",
        body: {
          departmentId: dept,
          locationId: loc,
          recommendations: result.recommendations,
          confidence: result.confidence,
          model: result.model,
        },
      });
      setNotice(t("ההמלצות אושרו והוחל שיבוץ."));
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const pickerTitle = picker === "dept" ? t("מחלקה") : picker === "loc" ? t("מיקום") : picker === "from" ? t("מתאריך") : t("עד תאריך");
  const pickerOptions =
    picker === "dept"
      ? departments.map((item) => ({ id: item.id, label: item.name }))
      : picker === "loc"
        ? locations.map((item) => ({ id: item.id, label: item.name }))
        : dateChoices.map((iso) => ({ id: iso, label: iso }));

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={t("המלצות AI")} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>{t("המלצות AI")}</Text>
          <Pressable onPress={() => void load().catch((err) => setError(errorText(err)))} hitSlop={8}>
            <MaterialIcons name="refresh" size={22} color={colors.orange} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {t("מנתח שיבוצים, חניות, חגים ותחזית גשם בסיסית בתל אביב. ההמלצות לא יחולו בלי אישור.")}
          </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {loading ? <ActivityIndicator color={colors.orange} style={{ marginTop: 20 }} /> : null}

        {coverage ? (
          <View style={styles.coverage}>
            <Text style={styles.coverageTitle}>{coverage.title}</Text>
            <Text style={styles.coverageLead}>
              {t("בכל יום בשבוע הבא חייב להיות לפחות מנהל אחד ששובץ במשרד — לא מספיק עובדים בלבד.")}
              </Text>
            <Text style={styles.coverageBody}>{coverage.detail}</Text>
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.titleRow}>
            <Text style={styles.panelTitle}>{t("התראות חכמות")}</Text>
            <Text style={styles.count}>{alerts.length}</Text>
          </View>
          <Text style={styles.hint}>{t("לוח שיבוצים (30 יום), חגים, גשם, וחניות פנויות.")}</Text>
          {!loading && alerts.length === 0 ? <Text style={styles.empty}>{t("אין כרגע התראות — הצוות מאוזן.")}</Text> : null}
          {alerts.map((item) => (
            <View key={item.id} style={[styles.alert, { borderRightColor: SEV_COLOR[item.severity], backgroundColor: `${SEV_COLOR[item.severity]}14` }]}>
              {item.name ? <Text style={styles.alertName}>{item.name}</Text> : null}
              <Text style={[styles.alertTitle, { color: SEV_COLOR[item.severity] }]}>{item.title}</Text>
              <Text style={styles.alertDetail}>{item.detail}</Text>
              {item.members && item.members.length > 0 ? (
                <Pressable onPress={() => setOpenGroup((current) => (current === item.id ? null : item.id))}>
                  <Text style={styles.expand}>{openGroup === item.id ? t("הסתרת רשימה") : t("הצגת רשימת עובדים")}</Text>
                </Pressable>
              ) : null}
              {openGroup === item.id
                ? item.members?.map((member) => (
                    <Text key={member} style={styles.member}>
                      {member}
                    </Text>
                  ))
                : null}
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Pressable onPress={() => setFormOpen((open) => !open)} style={styles.titleRow}>
            <Text style={styles.panelTitle}>{t("הפק המלצות AI חדשות")}</Text>
            <MaterialIcons name={formOpen ? "expand-less" : "expand-more"} size={24} color={colors.muted} />
          </Pressable>
          <Text style={styles.hint}>{t("ההמלצות לא יחולו בלי אישור — מנהל מערכת או מנהל מחלקה (רק למחלקתו).")}</Text>
          {formOpen ? (
            <View>
              {isAdmin ? (
                <Pressable onPress={() => setPicker("dept")} style={styles.field}>
                  <Text style={styles.fieldText}>{deptName}</Text>
                </Pressable>
              ) : (
                <Text style={styles.locked}>{dept ? deptName : t("אין מחלקה משויכת לחשבון.")}</Text>
              )}
              <Pressable onPress={() => setPicker("loc")} style={styles.field}>
                <Text style={styles.fieldText}>{locName}</Text>
              </Pressable>
              <Pressable onPress={() => setPicker("from")} style={styles.field}>
                <Text style={styles.fieldText}>{from ? tr(`מ־${from}`, `From ${from}`) : t("מתאריך")}</Text>
              </Pressable>
              <Pressable onPress={() => setPicker("to")} style={styles.field}>
                <Text style={styles.fieldText}>{to ? tr(`עד ${to}`, `Until ${to}`) : t("עד תאריך")}</Text>
              </Pressable>
              <Text style={styles.label}>{t("מינימום במשרד ליום")}</Text>
              <TextInput value={minOffice} onChangeText={setMinOffice} keyboardType="number-pad" style={styles.input} />
              <Text style={styles.label}>{t("קיבולת מקסימלית")}</Text>
              <TextInput value={cap} onChangeText={setCap} keyboardType="number-pad" style={styles.input} />
              {isAdmin ? (
                <View style={styles.switchRow}>
                  <Switch value={weekend} onValueChange={setWeekend} />
                  <Text style={styles.switchText}>{t("אפשר שיבוץ משרד בשישי/שבת בהמלצת ה-AI")}</Text>
                </View>
              ) : null}
              <Pressable
                disabled={busy || !dept || !loc || !from || !to}
                onPress={() => void recommend()}
                style={({ pressed }) => [styles.primary, (busy || !dept || !loc || !from || !to) && styles.disabled, pressed && styles.primaryPressed]}
              >
                <Text style={styles.primaryText}>{busy ? t("מנתח…") : t("הפק המלצות")}</Text>
              </Pressable>
              {result?.validation && result.validation.ok === false ? (
                <View style={styles.coverage}>
                  <Text style={styles.coverageTitle}>{t("לא ניתן לאשר: ההמלצה לא עומדת בבדיקות הארגון")}</Text>
                  {result.validation.errors.map((line) => (
                    <Text key={line} style={styles.coverageBody}>
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}
              {result?.preferenceContext ? (
                <Text style={styles.hint}>
                  {tr(
                    `נטענו ${result.preferenceContext.submittedPreferenceDocuments} הגשות מ־${result.preferenceContext.employeesWithSubmittedPrefs} עובדים, ${result.preferenceContext.employeeDaysWithPreference} ימים עם העדפה.`,
                    `Loaded ${result.preferenceContext.submittedPreferenceDocuments} submissions from ${result.preferenceContext.employeesWithSubmittedPrefs} people, ${result.preferenceContext.employeeDaysWithPreference} days with a preference.`
                  )}
                </Text>
              ) : null}
              {result?.preferenceVsRecommendation && result.preferenceVsRecommendation.recommendationRows > 0 ? (
                <Text style={styles.hint}>
                  {tr(
                    `מתוך ${result.preferenceVsRecommendation.recommendationRows} שורות: ${result.preferenceVsRecommendation.matchedPreference} תואמות, ${result.preferenceVsRecommendation.differsFromPreference} שונות, ${result.preferenceVsRecommendation.noSubmittedPreferenceForSlot} בלי העדפה.`,
                    `Of ${result.preferenceVsRecommendation.recommendationRows} rows: ${result.preferenceVsRecommendation.matchedPreference} match, ${result.preferenceVsRecommendation.differsFromPreference} differ, ${result.preferenceVsRecommendation.noSubmittedPreferenceForSlot} have no preference.`
                  )}
                </Text>
              ) : null}
              {result ? (
                <View>
                  <Text style={styles.hint}>
                    {tr(
                      `רמת ביטחון: ${result.confidence ?? "—"} · מודל: ${result.model ?? "—"}`,
                      `Confidence: ${result.confidence ?? "—"} · model: ${result.model ?? "—"}`
                    )}
                    {result.validation?.ok === true ? t(" · אימות כללי עבר") : ""}
                  </Text>
                  {result.recommendations.slice(0, 40).map((row, index) => (
                    <View key={`${row.date}-${row.employeeId}-${index}`} style={styles.recRow}>
                      <Text style={styles.alertName}>
                        {names.get(row.employeeId) || t("עובד")} · {row.date}
                      </Text>
                      <Text style={styles.alertDetail}>
                        {statusLabel(row.recommendedStatus)}
                        {row.reason ? ` · ${row.reason}` : ""}
                      </Text>
                    </View>
                  ))}
                  <Pressable
                    disabled={busy || result.validation?.ok === false || result.recommendations.length === 0}
                    onPress={() => void approve()}
                    style={[styles.approve, (busy || result.validation?.ok === false || result.recommendations.length === 0) && styles.disabled]}
                  >
                    <Text style={styles.primaryText}>{t("אישור והחלה")}</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{pickerTitle}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {pickerOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    if (picker === "dept") setDept(option.id);
                    if (picker === "loc") setLoc(option.id);
                    if (picker === "from") setFrom(option.id);
                    if (picker === "to") setTo(option.id);
                    setPicker(null);
                  }}
                  style={styles.choice}
                >
                  <Text style={styles.choiceText}>{t(option.label)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12, },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  pageTitle: { color: colors.ink, fontSize: 26, fontWeight: "800", },
  subtitle: { color: colors.muted, lineHeight: 22, marginVertical: 10 },
  error: { backgroundColor: colors.dangerBg, color: colors.danger, borderRadius: 12, padding: 12, marginBottom: 10, overflow: "hidden" },
  notice: { backgroundColor: "#dcfce7", color: "#166534", borderRadius: 12, padding: 12, marginBottom: 10, overflow: "hidden" },
  coverage: { backgroundColor: "#fef2f2", borderRadius: 14, padding: 12, marginBottom: 12 },
  coverageTitle: { color: "#991b1b", fontWeight: "800", },
  coverageLead: { color: "#7f1d1d", fontWeight: "700", marginTop: 6, lineHeight: 20 },
  coverageBody: { color: "#7f1d1d", marginTop: 4, lineHeight: 20 },
  panel: { backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: "rgba(245,158,11,0.35)", padding: 14, marginBottom: 12 },
  panelTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", flex: 1, },
  count: { backgroundColor: "#f59e0b", color: "#ffffff", fontWeight: "800", borderRadius: 16, overflow: "hidden", minWidth: 32, textAlign: "center", paddingHorizontal: 8, paddingVertical: 4 },
  hint: { color: colors.muted, marginTop: 4, marginBottom: 8, lineHeight: 20 },
  empty: { color: "#166534", },
  alert: { borderRadius: 12, borderRightWidth: 4, padding: 10, marginBottom: 8 },
  alertName: { color: colors.ink, fontWeight: "800", },
  alertTitle: { fontWeight: "800", marginTop: 2 },
  alertDetail: { color: colors.muted, marginTop: 2, lineHeight: 20 },
  expand: { color: colors.orange, fontWeight: "800", marginTop: 6 },
  member: { color: colors.ink, marginTop: 2 },
  field: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, justifyContent: "center", backgroundColor: "#ffffff", marginTop: 8 },
  fieldText: { color: colors.ink, fontWeight: "700", },
  locked: { color: colors.muted, marginTop: 8 },
  label: { color: colors.muted, marginTop: 10 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, backgroundColor: "#ffffff", color: colors.ink, marginTop: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  switchText: { flex: 1, color: colors.ink, fontWeight: "700" },
  primary: { marginTop: 12, backgroundColor: colors.orange, borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  primaryPressed: { backgroundColor: colors.orangePressed },
  primaryText: { color: "#ffffff", fontWeight: "800", },
  approve: { marginTop: 12, backgroundColor: "#d97706", borderRadius: 12, minHeight: 46, alignItems: "center", justifyContent: "center" },
  recRow: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 8 },
  disabled: { opacity: 0.45 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  choice: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  choiceText: { color: colors.ink, fontWeight: "600" },
});
