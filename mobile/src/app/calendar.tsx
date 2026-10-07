import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";

type Role = "admin" | "manager" | "employee";
type Tab = "seven" | "fifteen" | "month";

type Employee = {
  id: string;
  fullName: string;
  role: Role;
  isActive: boolean;
};

type Schedule = {
  id: string;
  employeeId: string;
  workDate: string;
  status: string;
  note?: string;
};

type DayAgg = {
  _id: string;
  office: number;
  home: number;
  client?: number;
  vacation: number;
  sick: number;
  off: number;
};

type Chip = {
  key: string;
  color: string;
  icon: (typeof STATUS)[number]["icon"];
  count: number;
};

type DayView = {
  iso: string;
  dayNum: number;
  weekday: string;
  monthShort: string;
  chips: Chip[];
  missingManager: boolean;
  managers: string[];
};

const WEEKDAY = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const WEEKDAY_FULL = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];
const STATUS_LABEL: Record<string, string> = {
  office: "משרד",
  home: "בית",
  client: "מחוץ למשרד – לקוח",
  vacation: "חופשה",
  sick: "חופשת מחלה",
  off: "לא עובד",
};

const STATUS = [
  { key: "office", color: "#0ea5e9", icon: "business-center" },
  { key: "home", color: "#f97316", icon: "home" },
  { key: "client", color: "#8b5cf6", icon: "handshake" },
  { key: "vacation", color: "#22c55e", icon: "beach-access" },
  { key: "sick", color: "#ef4444", icon: "sick" },
  { key: "off", color: "#94a3b8", icon: "event-busy" },
] as const;

function isoFromDate(d: Date): string {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

function monthEnd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${ym}-${String(last).padStart(2, "0")}`;
}

function next7Days() {
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

async function loadCompanyEmployees(): Promise<Employee[]> {
  const all: Employee[] = [];
  let page = 1;
  while (page < 20) {
    const data = await api<{ items: Employee[]; total: number }>(
      `/api/employees?scope=company&page=${page}&limit=100`
    );
    all.push(...data.items);
    if (all.length >= data.total || data.items.length === 0) break;
    page += 1;
  }
  return all;
}

function countsFromAgg(agg?: DayAgg): Record<string, number> {
  return {
    office: agg?.office ?? 0,
    home: agg?.home ?? 0,
    client: agg?.client ?? 0,
    vacation: agg?.vacation ?? 0,
    sick: agg?.sick ?? 0,
    off: agg?.off ?? 0,
  };
}

function chipsFromCounts(counts: Record<string, number>): Chip[] {
  return STATUS.map((meta) => ({ ...meta, count: counts[meta.key] ?? 0 })).filter((chip) => chip.count > 0);
}

function chipsFromRows(rows: Schedule[]): Chip[] {
  const counts: Record<string, number> = {};
  for (const meta of STATUS) {
    counts[meta.key] = new Set(rows.filter((row) => row.status === meta.key).map((row) => row.employeeId)).size;
  }
  return chipsFromCounts(counts);
}

export default function CalendarScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("seven");
  const [month, setMonth] = useState(currentYm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [weekRows, setWeekRows] = useState<Schedule[]>([]);
  const [monthRows, setMonthRows] = useState<Schedule[]>([]);
  const [monthDays, setMonthDays] = useState<DayAgg[]>([]);
  const [openIso, setOpenIso] = useState<string | null>(null);
  const [dayItems, setDayItems] = useState<Schedule[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "signedIn") return;
    let cancelled = false;
    const days7 = next7Days();
    const from = isoFromDate(days7[0]);
    const to = isoFromDate(days7[6]);
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [people, week, monthSchedules, monthAgg] = await Promise.all([
          loadCompanyEmployees(),
          api<{ items: Schedule[] }>(`/api/schedules?from=${from}&to=${to}&scope=company`),
          api<{ items: Schedule[] }>(`/api/schedules?from=${month}-01&to=${monthEnd(month)}&scope=company`),
          api<{ days: DayAgg[] }>(`/api/schedules/month/${month}?scope=company`),
        ]);
        if (cancelled) return;
        setEmployees(people);
        setWeekRows(week.items);
        setMonthRows(monthSchedules.items);
        setMonthDays(monthAgg.days);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "לא ניתן לטעון את היומן");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, month]);

  const today = isoFromDate(new Date());
  const utcToday = new Date().toISOString().slice(0, 10);
  const canSeeGaps = user?.role === "admin" || user?.role === "manager";

  const describe = useMemo(() => {
    const byId = new Map(employees.map((e) => [e.id, e]));
    const leaders = new Set(
      employees.filter((e) => e.isActive && (e.role === "admin" || e.role === "manager")).map((e) => e.id)
    );
    const activeRows = (rows: Schedule[]) =>
      rows.filter((row) => row.workDate < utcToday || byId.get(row.employeeId)?.isActive !== false);

    return (iso: string, rows: Schedule[], counts?: Record<string, number>): DayView => {
      const list = activeRows(rows).filter((row) => row.workDate === iso);
      const chips = counts ? chipsFromCounts(counts) : chipsFromRows(list);
      const date = new Date(`${iso}T12:00:00`);
      const managers = [
        ...new Set(
          list
            .filter((row) => row.status === "office" && leaders.has(row.employeeId))
            .map((row) => byId.get(row.employeeId)?.fullName)
            .filter((name): name is string => Boolean(name))
        ),
      ].sort((a, b) => a.localeCompare(b, "he"));
      return {
        iso,
        dayNum: date.getDate(),
        weekday: WEEKDAY[date.getDay()] ?? "",
        monthShort: date.toLocaleDateString("he-IL", { month: "short" }),
        chips,
        missingManager: canSeeGaps && leaders.size > 0 && managers.length === 0,
        managers,
      };
    };
  }, [employees, canSeeGaps, utcToday]);

  const seven = useMemo(
    () => next7Days().map((date) => describe(isoFromDate(date), weekRows)),
    [describe, weekRows]
  );

  const fifteen = useMemo(() => {
    const last = Number(monthEnd(month).slice(8));
    const take = Math.min(15, last);
    return Array.from({ length: take }, (_, index) => {
      const iso = `${month}-${String(index + 1).padStart(2, "0")}`;
      return describe(iso, monthRows, countsFromAgg(monthDays.find((day) => day._id === iso)));
    });
  }, [describe, month, monthDays, monthRows]);

  const weeks = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const cells: (DayView | null)[] = [];
    for (let i = 0; i < new Date(y, m - 1, 1).getDay(); i++) cells.push(null);
    for (let day = 1; day <= last; day++) {
      const iso = `${month}-${String(day).padStart(2, "0")}`;
      const agg = monthDays.find((item) => item._id === iso);
      cells.push(describe(iso, monthRows, countsFromAgg(agg)));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (DayView | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [describe, month, monthDays, monthRows]);

  async function openDay(iso: string) {
    setOpenIso(iso);
    setDayLoading(true);
    setDayError(null);
    setDayItems([]);
    try {
      const data = await api<{ items: Schedule[] }>(`/api/schedules/day/${iso}?scope=company`);
      const utcToday = new Date().toISOString().slice(0, 10);
      const byId = new Map(employees.map((person) => [person.id, person]));
      setDayItems(
        data.items.filter((row) => row.workDate < utcToday || byId.get(row.employeeId)?.isActive !== false)
      );
    } catch (err) {
      setDayError(err instanceof Error ? err.message : "לא ניתן לטעון את היום");
    } finally {
      setDayLoading(false);
    }
  }

  if (status === "signedOut") return <Redirect href="/login" />;
  if (user && !canOpen(user.role, "calendar")) return <Redirect href="/home" />;

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={user ? `שלום, ${user.fullName}` : undefined} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <View style={styles.titleRow}>
          <MaterialIcons name="calendar-month" size={26} color={colors.orange} />
          <Text style={styles.title}>{tab === "month" ? "יומן — חודש מלא" : "יומן"}</Text>
        </View>

        <View style={styles.tabs}>
          {(
            [
              ["seven", "7 ימים קרובים"],
              ["fifteen", "15 ימים מהחודש"],
              ["month", "חודש מלא"],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabOn]}>
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonth((value) => shiftMonth(value, -1))} style={styles.monthButton}>
            <MaterialIcons name="chevron-right" size={26} color={colors.ink} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <Pressable onPress={() => setMonth((value) => shiftMonth(value, 1))} style={styles.monthButton}>
            <MaterialIcons name="chevron-left" size={26} color={colors.ink} />
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={colors.orange} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === "seven" ? (
          <>
            <Text style={styles.subtitle}>7 הימים הקרובים</Text>
            <View style={styles.grid}>
              {seven.map((day) => (
                <DayCard key={day.iso} day={day} today={today} wide onPress={() => void openDay(day.iso)} />
              ))}
            </View>
          </>
        ) : null}

        {tab === "fifteen" ? (
          <>
            <Text style={styles.subtitle}>תצוגת חודש — 15 ימים</Text>
            <Pressable onPress={() => setTab("month")} style={styles.openMonth}>
              <Text style={styles.openMonthText}>פתיחת לוח חודש מלא</Text>
            </Pressable>
            <View style={styles.grid}>
              {fifteen.map((day) => (
                <DayCard key={day.iso} day={day} today={today} wide={false} onPress={() => void openDay(day.iso)} />
              ))}
            </View>
          </>
        ) : null}

        {tab === "month" ? (
          <>
            <Text style={styles.subtitle}>כל ימי החודש</Text>
            <View style={styles.weekHead}>
              {WEEKDAY.map((letter) => (
                <Text key={letter} style={styles.weekLetter}>
                  {letter}
                </Text>
              ))}
            </View>
            {weeks.map((row, index) => (
              <View key={index} style={styles.weekRow}>
                {row.map((day, cell) =>
                  day ? (
                    <Pressable
                      key={day.iso}
                      onPress={() => void openDay(day.iso)}
                      style={[
                        styles.monthCell,
                        day.iso === today && styles.dayToday,
                        day.missingManager && styles.dayMissing,
                      ]}
                    >
                      <Text style={[styles.monthNum, day.iso === today && styles.dayNumToday]}>{day.dayNum}</Text>
                      <View style={styles.monthChips}>
                        {day.chips.slice(0, 3).map((chip) => (
                          <Text key={chip.key} style={[styles.miniCount, { color: chip.color }]}>
                            {chip.count}
                          </Text>
                        ))}
                      </View>
                    </Pressable>
                  ) : (
                    <View key={`empty-${index}-${cell}`} style={styles.monthCellEmpty} />
                  )
                )}
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.footer}>Plan today. Work better tomorrow.</Text>
      </ScrollView>
      <DayRoster
        iso={openIso}
        items={dayItems}
        loading={dayLoading}
        error={dayError}
        employees={employees}
        onClose={() => setOpenIso(null)}
      />
    </View>
  );
}

function DayCard({ day, today, wide, onPress }: { day: DayView; today: string; wide: boolean; onPress: () => void }) {
  const isToday = day.iso === today;
  return (
    <Pressable onPress={onPress} style={[wide ? styles.day : styles.dayThird, isToday && styles.dayToday, day.missingManager && styles.dayMissing]}>
      <View style={styles.dayHead}>
        <Text style={styles.dayMeta}>
          {day.weekday} · {day.monthShort}
        </Text>
        {isToday ? <Text style={styles.today}>היום</Text> : null}
      </View>
      <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>{day.dayNum}</Text>
      <View style={styles.chips}>
        {day.chips.map((chip) => (
          <View key={chip.key} style={[styles.chip, { backgroundColor: `${chip.color}24` }]}>
            <MaterialIcons name={chip.icon} size={14} color={chip.color} />
            <Text style={[styles.chipText, { color: chip.color }]}>{chip.count}</Text>
          </View>
        ))}
      </View>
      {day.missingManager ? (
        <Text style={styles.missing}>לא שובץ מנהל במשרד</Text>
      ) : day.managers.length > 0 ? (
        <Text style={styles.managers}>הנהלה במשרד: {day.managers.join(" · ")}</Text>
      ) : null}
    </Pressable>
  );
}

function DayRoster({
  iso,
  items,
  loading,
  error,
  employees,
  onClose,
}: {
  iso: string | null;
  items: Schedule[];
  loading: boolean;
  error: string | null;
  employees: Employee[];
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const names = new Map(employees.map((person) => [person.id, person.fullName]));
  const groups = STATUS.map((meta) => ({
    ...meta,
    label: STATUS_LABEL[meta.key] ?? meta.key,
    rows: items.filter((row) => row.status === meta.key).sort((a, b) =>
      (names.get(a.employeeId) ?? "").localeCompare(names.get(b.employeeId) ?? "", "he")
    ),
  })).filter((group) => group.rows.length > 0);
  const title = iso
    ? `${iso} · ${WEEKDAY_FULL[new Date(`${iso}T12:00:00`).getDay()] ?? ""}`
    : "";

  return (
    <Modal visible={!!iso} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.rosterScreen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.rosterHead}>
          <Text style={styles.rosterTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <MaterialIcons name="close" size={26} color={colors.ink} />
          </Pressable>
        </View>
        {loading ? <ActivityIndicator color={colors.orange} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ScrollView contentContainerStyle={styles.rosterList}>
          {!loading && groups.length === 0 ? <Text style={styles.emptyDay}>אין שיבוץ ליום זה</Text> : null}
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHead}>
                <MaterialIcons name={group.icon} size={18} color={group.color} />
                <Text style={[styles.groupTitle, { color: group.color }]}>{group.label}</Text>
                <Text style={[styles.groupCount, { color: group.color }]}>{group.rows.length}</Text>
              </View>
              {group.rows.map((row) => (
                <View key={row.id} style={[styles.personRow, { backgroundColor: `${group.color}14`, borderRightColor: group.color }]}>
                  <Text style={styles.personName}>{names.get(row.employeeId) ?? "עובד"}</Text>
                  {row.note?.trim() ? <Text style={styles.personNote}>{row.note.trim()}</Text> : null}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 16, direction: "rtl" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.ink, fontSize: 26, fontWeight: "800", writingDirection: "rtl", flex: 1, textAlign: "right" },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  tab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  tabOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabText: { color: colors.ink, fontWeight: "700", writingDirection: "rtl" },
  tabTextOn: { color: "#ffffff" },
  monthRow: {
    direction: "rtl",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 8,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    paddingHorizontal: 6,
  },
  monthButton: { padding: 8 },
  monthLabel: { color: colors.ink, fontSize: 16, fontWeight: "800", writingDirection: "rtl" },
  subtitle: { color: colors.muted, fontSize: 15, writingDirection: "rtl", textAlign: "right", marginBottom: 8 },
  openMonth: { alignSelf: "flex-start", marginBottom: 12 },
  openMonthText: { color: colors.orange, fontWeight: "800", writingDirection: "rtl", textAlign: "right" },
  loader: { marginVertical: 24 },
  error: { color: colors.danger, textAlign: "right", writingDirection: "rtl", marginBottom: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10 },
  day: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    padding: 10,
    minHeight: 148,
  },
  dayThird: {
    width: "48%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    padding: 10,
    minHeight: 132,
  },
  dayToday: { borderColor: colors.orange, backgroundColor: "rgba(249,115,22,0.08)" },
  dayMissing: { borderColor: "rgba(239,68,68,0.55)", backgroundColor: "rgba(239,68,68,0.06)" },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayMeta: { color: colors.muted, fontSize: 13, fontWeight: "700", writingDirection: "rtl" },
  today: {
    color: "#ffffff",
    backgroundColor: colors.orange,
    overflow: "hidden",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontSize: 11,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  dayNum: { color: colors.ink, fontSize: 28, fontWeight: "800", textAlign: "right", marginTop: 2 },
  dayNumToday: { color: colors.orange },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  chipText: { fontSize: 13, fontWeight: "800" },
  missing: { color: "#b91c1c", fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  managers: { color: "#15803d", fontSize: 12, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  weekHead: { direction: "rtl", flexDirection: "row" },
  weekLetter: { width: "14.28%", textAlign: "center", color: colors.muted, fontWeight: "800", writingDirection: "rtl" },
  weekRow: { direction: "rtl", flexDirection: "row" },
  monthCell: {
    width: "14.28%",
    minHeight: 58,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    backgroundColor: "#ffffff",
    padding: 2,
  },
  monthCellEmpty: { width: "14.28%", minHeight: 58 },
  monthChips: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 2 },
  monthNum: { color: colors.ink, fontSize: 13, fontWeight: "800", textAlign: "right" },
  miniCount: { fontSize: 11, fontWeight: "800" },
  rosterScreen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, direction: "rtl" },
  rosterHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  rosterTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", writingDirection: "rtl", flex: 1, textAlign: "right" },
  rosterList: { paddingBottom: 24 },
  emptyDay: { color: colors.muted, textAlign: "right", writingDirection: "rtl", marginTop: 12 },
  group: { marginBottom: 16 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  groupTitle: { fontWeight: "800", writingDirection: "rtl", fontSize: 16 },
  groupCount: { fontWeight: "800" },
  personRow: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, borderRightWidth: 4 },
  personName: { color: colors.ink, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  personNote: { color: colors.muted, textAlign: "right", writingDirection: "rtl", marginTop: 2 },
  footer: {
    marginTop: 22,
    textAlign: "center",
    writingDirection: "ltr",
    color: colors.muted,
    fontStyle: "italic",
    fontSize: 16,
  },
});
