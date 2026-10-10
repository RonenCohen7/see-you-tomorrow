import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";
import { hello, intlTag, t, tr } from "@/locale/i18n";
import { useLocale } from "@/locale/LocaleProvider";

type Role = "admin" | "manager" | "employee";
type Tab = "seven" | "fifteen" | "month";

type Employee = {
  id: string;
  fullName: string;
  role: Role;
  departmentId?: string;
  isActive: boolean;
};

type Schedule = {
  id: string;
  employeeId: string;
  workDate: string;
  status: string;
  hours?: number;
  note?: string;
  source?: string;
};

type StatusChoice = { value: string; label: string; color: string };

type ShiftDraft = {
  id?: string;
  employeeId: string;
  status: string;
  hours: string;
  note: string;
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

type StatusLine = {
  key: string;
  color: string;
  icon: (typeof STATUS)[number]["icon"];
  label: string;
  count: number;
  names: string;
};

type DayView = {
  iso: string;
  dayNum: number;
  weekday: string;
  monthShort: string;
  chips: Chip[];
  lines: StatusLine[];
  missingManager: boolean;
  managers: string[];
  parkingCount: number;
  meetingCount: number;
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
  return new Date(y, m - 1, 1).toLocaleDateString(intlTag(), { month: "long", year: "numeric" });
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

function daysInMonth(ym: string): number {
  return Number(monthEnd(ym).slice(8));
}

/** Sunday–Saturday weeks that touch the month. Week 1 starts on the Sunday of the week that contains the 1st. */
function calendarWeeks(ym: string): Date[][] {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return [];
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const cursor = new Date(first);
  cursor.setDate(first.getDate() - first.getDay());
  const weeks: Date[][] = [];
  while (cursor <= last && weeks.length < 6) {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      days.push(d);
    }
    weeks.push(days);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

function monthWeekCount(ym: string): number {
  return calendarWeeks(ym).length;
}

function weekDates(ym: string, week: number): Date[] {
  return calendarWeeks(ym)[week - 1] ?? [];
}

function countByDate<T extends { workDate: string }>(items: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.workDate] = (counts[item.workDate] ?? 0) + 1;
  return counts;
}

async function optionalItems<T>(path: string): Promise<T[]> {
  try {
    const data = await api<{ items: T[] }>(path);
    return data.items;
  } catch {
    return [];
  }
}

export default function CalendarScreen() {
  const { status, user } = useAuth();
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("seven");
  const [month, setMonth] = useState(currentYm);
  const [sevenPick, setSevenPick] = useState<"upcoming" | number>("upcoming");
  const [fifteenPick, setFifteenPick] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [weekRows, setWeekRows] = useState<Schedule[]>([]);
  const [monthRows, setMonthRows] = useState<Schedule[]>([]);
  const [monthDays, setMonthDays] = useState<DayAgg[]>([]);
  const [parkingCounts, setParkingCounts] = useState<Record<string, number>>({});
  const [meetingCounts, setMeetingCounts] = useState<Record<string, number>>({});
  const [openIso, setOpenIso] = useState<string | null>(null);
  const [dayItems, setDayItems] = useState<Schedule[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [calendarRevision, setCalendarRevision] = useState(0);
  const quietRefresh = useRef(false);

  useEffect(() => {
    if (status !== "signedIn") return;
    let cancelled = false;
    const days7 = next7Days();
    const upcomingFrom = isoFromDate(days7[0]);
    const upcomingTo = isoFromDate(days7[6]);
    const covered = calendarWeeks(month);
    const coverFrom = covered[0] ? isoFromDate(covered[0][0]) : `${month}-01`;
    const coverTo = covered.length ? isoFromDate(covered[covered.length - 1][6]) : monthEnd(month);
    const spanFrom = upcomingFrom < coverFrom ? upcomingFrom : coverFrom;
    const spanTo = upcomingTo > coverTo ? upcomingTo : coverTo;
    const silent = quietRefresh.current;
    quietRefresh.current = false;
    (async () => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [people, week, monthSchedules, monthAgg, parking, meetings] = await Promise.all([
          loadCompanyEmployees(),
          api<{ items: Schedule[] }>(`/api/schedules?from=${upcomingFrom}&to=${upcomingTo}&scope=company`),
          api<{ items: Schedule[] }>(`/api/schedules?from=${coverFrom}&to=${coverTo}&scope=company`),
          api<{ days: DayAgg[] }>(`/api/schedules/month/${month}?scope=company`),
          optionalItems<{ workDate: string }>(`/api/parking/reservations?from=${spanFrom}&to=${spanTo}`),
          optionalItems<{ workDate: string }>(`/api/meeting-rooms/bookings?from=${spanFrom}&to=${spanTo}`),
        ]);
        if (cancelled) return;
        setEmployees(people);
        setWeekRows(week.items);
        setMonthRows(monthSchedules.items);
        setMonthDays(monthAgg.days);
        setParkingCounts(countByDate(parking));
        setMeetingCounts(countByDate(meetings));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("לא ניתן לטעון את היומן"));
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, month, calendarRevision, quietRefresh]);

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
      const lines: StatusLine[] = STATUS.flatMap((meta) => {
        const names = [
          ...new Set(
            list
              .filter((row) => row.status === meta.key)
              .map((row) => byId.get(row.employeeId)?.fullName)
              .filter((name): name is string => Boolean(name))
          ),
        ].sort((a, b) => a.localeCompare(b, "he"));
        if (names.length === 0) return [];
        return [{ ...meta, label: t(STATUS_LABEL[meta.key]) ?? meta.key, count: names.length, names: names.join(", ") }];
      });
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
        weekday: t(WEEKDAY[date.getDay()] ?? ""),
        monthShort: date.toLocaleDateString(intlTag(), { month: "short" }),
        chips,
        lines,
        missingManager: canSeeGaps && leaders.size > 0 && managers.length === 0,
        managers,
        parkingCount: parkingCounts[iso] ?? 0,
        meetingCount: meetingCounts[iso] ?? 0,
      };
    };
  }, [employees, canSeeGaps, utcToday, parkingCounts, meetingCounts]);

  const weekTotal = monthWeekCount(month);
  const activeWeek = typeof sevenPick === "number" ? Math.min(sevenPick, weekTotal) : "upcoming";
  const seven = useMemo(() => {
    const dates = activeWeek === "upcoming" ? next7Days() : weekDates(month, activeWeek);
    return dates.map((date) => describe(isoFromDate(date), activeWeek === "upcoming" ? weekRows : monthRows));
  }, [describe, activeWeek, month, weekRows, monthRows]);

  const fifteen = useMemo(() => {
    const last = daysInMonth(month);
    const fromDay = fifteenPick === 1 ? 1 : 16;
    const toDay = fifteenPick === 1 ? Math.min(15, last) : last;
    return Array.from({ length: Math.max(0, toDay - fromDay + 1) }, (_, index) => {
      const iso = `${month}-${String(fromDay + index).padStart(2, "0")}`;
      return describe(iso, monthRows);
    });
  }, [describe, month, fifteenPick, monthRows]);

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

  async function openDay(iso: string, keep = false) {
    setOpenIso(iso);
    if (!keep) {
      setDayLoading(true);
      setDayItems([]);
    }
    setDayError(null);
    try {
      const data = await api<{ items: Schedule[] }>(`/api/schedules/day/${iso}?scope=company`);
      const utcToday = new Date().toISOString().slice(0, 10);
      const byId = new Map(employees.map((person) => [person.id, person]));
      setDayItems(
        data.items.filter((row) => row.workDate < utcToday || byId.get(row.employeeId)?.isActive !== false)
      );
    } catch (err) {
      setDayError(err instanceof Error ? err.message : t("לא ניתן לטעון את היום"));
    } finally {
      setDayLoading(false);
    }
  }

  if (status === "signedOut") return <Redirect href="/login" />;
  if (user && !canOpen(user.role, "calendar")) return <Redirect href="/home" />;

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={user ? hello(user.fullName) : undefined} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <View style={styles.titleRow}>
          <MaterialIcons name="calendar-month" size={26} color={colors.orange} />
          <Text style={styles.title}>{tab === "month" ? t("יומן — חודש מלא") : t("יומן")}</Text>
        </View>

        <View style={styles.tabs}>
          {(
            [
              ["seven", t("7 ימים קרובים")],
              ["fifteen", t("15 ימים מהחודש")],
              ["month", t("חודש מלא")],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabOn]}>
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.monthRow}>
          <Pressable onPress={() => setMonth((value) => shiftMonth(value, -1))} style={styles.monthButton}>
            <MaterialIcons name={locale === "he" ? "chevron-right" : "chevron-left"} size={26} color={colors.ink} />
          </Pressable>
          <Text style={styles.monthLabel}>{monthLabel(month)}</Text>
          <Pressable onPress={() => setMonth((value) => shiftMonth(value, 1))} style={styles.monthButton}>
            <MaterialIcons name={locale === "he" ? "chevron-left" : "chevron-right"} size={26} color={colors.ink} />
          </Pressable>
        </View>

        {loading ? <ActivityIndicator color={colors.orange} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === "seven" ? (
          <>
            <Text style={styles.subtitle}>
              {activeWeek === "upcoming" ? t("7 הימים הקרובים") : tr(`שבוע ${activeWeek} בחודש`, `Week ${activeWeek} of the month`)}
            </Text>
            <View style={styles.picks}>
              <Pressable
                onPress={() => setSevenPick("upcoming")}
                style={[styles.pick, activeWeek === "upcoming" && styles.pickOn]}
              >
                <Text style={[styles.pickText, activeWeek === "upcoming" && styles.pickTextOn]}>{t("הקרובים")}</Text>
              </Pressable>
              {Array.from({ length: weekTotal }, (_, index) => index + 1).map((week) => (
                <Pressable
                  key={week}
                  onPress={() => setSevenPick(week)}
                  style={[styles.pick, activeWeek === week && styles.pickOn]}
                >
                  <Text style={[styles.pickText, activeWeek === week && styles.pickTextOn]}>{t("שבוע")} {week}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.agendaList}>
              {seven.map((day) => (
                <AgendaRow key={day.iso} day={day} today={today} onPress={() => void openDay(day.iso)} />
              ))}
            </View>
          </>
        ) : null}

        {tab === "fifteen" ? (
          <>
            <Text style={styles.subtitle}>
              {fifteenPick === 1
                ? tr(`1–${Math.min(15, daysInMonth(month))} בחודש`, `1–${Math.min(15, daysInMonth(month))} of the month`)
                : tr(`16–${daysInMonth(month)} בחודש`, `16–${daysInMonth(month)} of the month`)}
            </Text>
            <View style={styles.picks}>
              <Pressable onPress={() => setFifteenPick(1)} style={[styles.pick, fifteenPick === 1 && styles.pickOn]}>
                <Text style={[styles.pickText, fifteenPick === 1 && styles.pickTextOn]}>
                  1–{Math.min(15, daysInMonth(month))}
                </Text>
              </Pressable>
              {daysInMonth(month) > 15 ? (
                <Pressable onPress={() => setFifteenPick(2)} style={[styles.pick, fifteenPick === 2 && styles.pickOn]}>
                  <Text style={[styles.pickText, fifteenPick === 2 && styles.pickTextOn]}>
                    16–{daysInMonth(month)}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={() => setTab("month")} style={styles.openMonth}>
              <Text style={styles.openMonthText}>{t("פתיחת לוח חודש מלא")}</Text>
            </Pressable>
            <View style={styles.agendaList}>
              {fifteen.map((day) => (
                <AgendaRow key={day.iso} day={day} today={today} onPress={() => void openDay(day.iso)} />
              ))}
            </View>
          </>
        ) : null}

        {tab === "month" ? (
          <>
            <Text style={styles.subtitle}>{t("כל ימי החודש")}</Text>
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
        user={user}
        onClose={() => setOpenIso(null)}
        onChanged={() => {
          quietRefresh.current = true;
          setCalendarRevision((value) => value + 1);
          if (openIso) void openDay(openIso, true);
        }}
      />
    </View>
  );
}

function AgendaRow({ day, today, onPress }: { day: DayView; today: string; onPress: () => void }) {
  const { locale } = useLocale();
  const isToday = day.iso === today;
  return (
    <Pressable onPress={onPress} style={[styles.agenda, isToday && styles.dayToday, day.missingManager && styles.dayMissing]}>
      <View style={[styles.agendaDate, isToday && styles.agendaDateToday]}>
        <Text style={[styles.agendaWeekday, isToday && styles.agendaDateText]}>
          {locale === "he" ? `יום ${day.weekday}` : day.weekday}
        </Text>
        <Text style={[styles.agendaNum, isToday && styles.agendaDateText]}>{day.dayNum}</Text>
        <Text style={[styles.agendaMonth, isToday && styles.agendaDateText]}>{day.monthShort}</Text>
        {isToday ? <Text style={styles.agendaToday}>{t("היום")}</Text> : null}
      </View>
      <View style={styles.agendaBody}>
        {day.lines.length === 0 ? <Text style={styles.agendaEmpty}>{t("אין שיבוץ ליום זה")}</Text> : null}
        {day.lines.map((line) => (
          <View key={line.key} style={styles.line}>
            <View style={[styles.lineChip, { backgroundColor: `${line.color}24` }]}>
              <MaterialIcons name={line.icon} size={14} color={line.color} />
              <Text style={[styles.lineChipText, { color: line.color }]}>
                {t(line.label)} {line.count}
              </Text>
            </View>
            <Text style={styles.lineNames}>{line.names}</Text>
          </View>
        ))}
        {day.missingManager ? (
          <Text style={styles.missing}>{t("לא שובץ מנהל במשרד")}</Text>
        ) : day.managers.length > 0 ? (
          <Text style={styles.managers}>{t("הנהלה במשרד:")} {day.managers.join(" · ")}</Text>
        ) : null}
        {day.parkingCount > 0 || day.meetingCount > 0 ? (
          <View style={styles.extraRow}>
            {day.parkingCount > 0 ? (
              <View style={styles.extra}>
                <MaterialIcons name="local-parking" size={16} color="#0d47a1" />
                <Text style={styles.extraParking}>{day.parkingCount}</Text>
              </View>
            ) : null}
            {day.meetingCount > 0 ? (
              <View style={styles.extra}>
                <MaterialIcons name="meeting-room" size={16} color="#004d40" />
                <Text style={styles.extraMeeting}>{day.meetingCount}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <MaterialIcons name={locale === "he" ? "chevron-left" : "chevron-right"} size={22} color={colors.muted} />
    </Pressable>
  );
}

function DayRoster({
  iso,
  items,
  loading,
  error,
  employees,
  user,
  onClose,
  onChanged,
}: {
  iso: string | null;
  items: Schedule[];
  loading: boolean;
  error: string | null;
  employees: Employee[];
  user: { id: string; role: Role; departmentId?: string } | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { locale } = useLocale();
  const canWrite = user?.role === "admin" || user?.role === "manager";
  const utcToday = new Date().toISOString().slice(0, 10);
  const [choices, setChoices] = useState<StatusChoice[]>([]);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<ShiftDraft | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!iso) {
      setDraft(null);
      setNotice(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<{
          disabledBuiltinScheduleStatuses?: string[];
          customScheduleStatuses?: { id: string; labelHe: string; labelEn?: string; disabled?: boolean }[];
        }>("/api/schedules/org-settings");
        if (cancelled) return;
        const disabled = new Set(data.disabledBuiltinScheduleStatuses ?? []);
        const next: StatusChoice[] = STATUS.filter((meta) => !disabled.has(meta.key)).map((meta) => ({
          value: meta.key,
          label: t(STATUS_LABEL[meta.key]),
          color: meta.color,
        }));
        const labels: Record<string, string> = {};
        for (const row of data.customScheduleStatuses ?? []) {
          const value = `custom:${row.id}`;
          const label = locale === "en" && row.labelEn?.trim() ? row.labelEn.trim() : row.labelHe;
          labels[value] = label;
          if (!row.disabled) next.push({ value, label, color: "#64748b" });
        }
        setChoices(next);
        setCustomLabels(labels);
      } catch {
        if (!cancelled) {
          setChoices(
            STATUS.map((meta) => ({
              value: meta.key,
              label: t(STATUS_LABEL[meta.key]),
              color: meta.color,
            }))
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [iso, locale]);

  const names = new Map(employees.map((person) => [person.id, person.fullName]));
  const byId = new Map(employees.map((person) => [person.id, person]));
  const sortName = (a: Schedule, b: Schedule) =>
    (names.get(a.employeeId) ?? "").localeCompare(names.get(b.employeeId) ?? "", intlTag());
  const builtinGroups = STATUS.map((meta) => ({
    key: meta.key,
    color: meta.color,
    icon: meta.icon,
    label: t(STATUS_LABEL[meta.key]),
    rows: items.filter((row) => row.status === meta.key).sort(sortName),
  })).filter((group) => group.rows.length > 0);
  const customKeys = [...new Set(items.map((row) => row.status).filter((status) => !STATUS.some((meta) => meta.key === status)))];
  const groups = [
    ...builtinGroups,
    ...customKeys.map((key) => ({
      key,
      color: "#64748b",
      icon: "label" as const,
      label: customLabels[key] ?? key,
      rows: items.filter((row) => row.status === key).sort(sortName),
    })),
  ];
  const title = iso
    ? `${iso} · ${t(WEEKDAY_FULL[new Date(`${iso}T12:00:00`).getDay()] ?? "")}`
    : "";

  function canEditEmployee(employeeId: string) {
    if (!canWrite || !user) return false;
    if (user.role === "admin") return true;
    const person = byId.get(employeeId);
    return Boolean(user.departmentId && person?.departmentId === user.departmentId);
  }

  function futureInactive(employeeId: string) {
    return Boolean(iso && iso >= utcToday && byId.get(employeeId)?.isActive === false);
  }

  const selectable = employees
    .filter((person) => person.isActive && canEditEmployee(person.id))
    .filter((person) => !query.trim() || person.fullName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, intlTag()));

  const draftChoices = draft && !choices.some((choice) => choice.value === draft.status)
    ? [{ value: draft.status, label: customLabels[draft.status] ?? t(STATUS_LABEL[draft.status] ?? draft.status), color: "#64748b" }, ...choices]
    : choices;

  function startAdd() {
    setFormError(null);
    setQuery("");
    setDraft({ employeeId: "", status: choices[0]?.value ?? "office", hours: "", note: "" });
  }

  function startEdit(row: Schedule) {
    if (futureInactive(row.employeeId)) return;
    setFormError(null);
    setDraft({
      id: row.id,
      employeeId: row.employeeId,
      status: row.status,
      hours: row.hours != null ? String(row.hours) : "",
      note: row.note ?? "",
    });
  }

  function confirmDelete(row: Schedule) {
    const name = names.get(row.employeeId) ?? t("עובד");
    Alert.alert(t("מחיקת שיבוץ"), tr(`למחוק את השיבוץ של ${name}?`, `Delete the assignment for ${name}?`), [
      { text: t("ביטול"), style: "cancel" },
      { text: t("מחיקה"), style: "destructive", onPress: () => void remove(row.id) },
    ]);
  }

  async function remove(id: string) {
    setFormError(null);
    try {
      await api(`/api/schedules/${id}`, { method: "DELETE" });
      setNotice(t("השיבוץ נמחק."));
      onChanged();
    } catch (err) {
      setNotice(null);
      setFormError(err instanceof Error ? err.message : t("המחיקה נכשלה."));
    }
  }

  async function save() {
    if (!draft || !iso || !draft.employeeId || futureInactive(draft.employeeId)) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        workDate: iso,
        status: draft.status,
        note: draft.note.trim() || undefined,
      };
      if (draft.hours.trim() !== "") {
        const hours = Number(draft.hours);
        if (Number.isNaN(hours) || hours < 0 || hours > 24) {
          setFormError(t("שעות חייבות להיות בין 0 ל-24."));
          setSaving(false);
          return;
        }
        payload.hours = hours;
      }
      if (draft.id) {
        await api(`/api/schedules/${draft.id}`, { method: "PUT", body: payload });
      } else {
        payload.employeeId = draft.employeeId;
        await api("/api/schedules", { method: "POST", body: payload });
      }
      setDraft(null);
      setNotice(t("השיבוץ נשמר."));
      onChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("השמירה נכשלה"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Modal visible={!!iso} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.rosterScreen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.rosterHead}>
          <Text style={styles.rosterTitle}>{title}</Text>
          {canWrite ? (
            <Pressable onPress={startAdd} hitSlop={8} accessibilityLabel={t("שיבוץ חדש")}>
              <MaterialIcons name="add-circle" size={28} color={colors.orange} />
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={8}>
            <MaterialIcons name="close" size={26} color={colors.ink} />
          </Pressable>
        </View>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {formError && !draft ? <Text style={styles.error}>{formError}</Text> : null}
        {loading ? <ActivityIndicator color={colors.orange} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ScrollView contentContainerStyle={styles.rosterList}>
          {!loading && groups.length === 0 ? <Text style={styles.emptyDay}>{t("אין שיבוץ ליום זה")}</Text> : null}
          {groups.map((group) => (
            <View key={group.key} style={styles.group}>
              <View style={styles.groupHead}>
                <MaterialIcons name={group.icon} size={18} color={group.color} />
                <Text style={[styles.groupTitle, { color: group.color }]}>{group.label}</Text>
                <Text style={[styles.groupCount, { color: group.color }]}>{group.rows.length}</Text>
              </View>
              {group.rows.map((row) => {
                const editable = canEditEmployee(row.employeeId);
                const locked = futureInactive(row.employeeId);
                return (
                  <View key={row.id} style={[styles.personRow, { backgroundColor: `${group.color}14`, borderRightColor: group.color }]}>
                    <View style={styles.personBody}>
                      <Text style={styles.personName}>{names.get(row.employeeId) ?? t("עובד")}</Text>
                      {row.hours != null ? (
                        <Text style={styles.personNote}>{tr(`${row.hours} שעות`, `${row.hours} hours`)}</Text>
                      ) : null}
                      {row.note?.trim() ? <Text style={styles.personNote}>{row.note.trim()}</Text> : null}
                      {row.source === "ai" ? <Text style={styles.aiTag}>AI</Text> : null}
                    </View>
                    {editable ? (
                      <View style={styles.rowActions}>
                        <Pressable
                          onPress={() => startEdit(row)}
                          disabled={locked}
                          hitSlop={6}
                          accessibilityLabel={t("עריכה")}
                        >
                          <MaterialIcons name="edit" size={22} color={locked ? colors.muted : colors.orange} />
                        </Pressable>
                        <Pressable onPress={() => confirmDelete(row)} hitSlop={6} accessibilityLabel={t("מחיקה")}>
                          <MaterialIcons name="delete-outline" size={22} color={colors.danger} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
      <Modal visible={!!draft} animationType="slide" onRequestClose={() => setDraft(null)}>
        <KeyboardAvoidingView
          style={[styles.rosterScreen, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.rosterHead}>
            <Text style={styles.rosterTitle}>{draft?.id ? t("עריכת שיבוץ") : t("שיבוץ חדש")}</Text>
            <Pressable onPress={() => setDraft(null)} hitSlop={8}>
              <MaterialIcons name="close" size={26} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {draft?.id ? (
              <Text style={styles.personName}>{names.get(draft.employeeId) ?? t("עובד")}</Text>
            ) : (
              <>
                <Text style={styles.fieldLabel}>{t("בחרו עובד")}</Text>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t("חיפוש עובד")}
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                {selectable.map((person) => (
                  <Pressable
                    key={person.id}
                    onPress={() => setDraft((current) => (current ? { ...current, employeeId: person.id } : current))}
                    style={[styles.choice, draft?.employeeId === person.id && styles.choiceOn]}
                  >
                    <Text style={styles.choiceText}>{person.fullName}</Text>
                  </Pressable>
                ))}
              </>
            )}
            {draft && futureInactive(draft.employeeId) ? (
              <Text style={styles.error}>{t("עובד לא פעיל — אי אפשר לערוך שיבוץ עתידי.")}</Text>
            ) : null}
            <Text style={styles.fieldLabel}>{t("סטטוס")}</Text>
            <View style={styles.picks}>
              {draftChoices.map((choice) => (
                <Pressable
                  key={choice.value}
                  onPress={() => setDraft((current) => (current ? { ...current, status: choice.value } : current))}
                  style={[styles.pick, draft?.status === choice.value && { backgroundColor: choice.color, borderColor: choice.color }]}
                >
                  <Text style={[styles.pickText, draft?.status === choice.value && styles.pickTextOn]}>{choice.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>{t("שעות (אופציונלי)")}</Text>
            <TextInput
              value={draft?.hours ?? ""}
              onChangeText={(hours) => setDraft((current) => (current ? { ...current, hours } : current))}
              keyboardType="decimal-pad"
              placeholder="0–24"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.hoursInput]}
            />
            <Text style={styles.fieldLabel}>{t("הערה")}</Text>
            <TextInput
              value={draft?.note ?? ""}
              onChangeText={(note) => setDraft((current) => (current ? { ...current, note } : current))}
              multiline
              style={[styles.input, styles.noteInput]}
            />
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Pressable
              onPress={() => void save()}
              disabled={!draft?.employeeId || saving || (draft ? futureInactive(draft.employeeId) : false)}
              style={[styles.saveButton, (!draft?.employeeId || saving) && styles.saveButtonOff]}
            >
              <Text style={styles.saveText}>{saving ? t("שומר...") : t("שמירה")}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 16, },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.ink, fontSize: 26, fontWeight: "800", flex: 1, },
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
  tabText: { color: colors.ink, fontWeight: "700", },
  tabTextOn: { color: "#ffffff" },
  monthRow: {
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
  monthLabel: { color: colors.ink, fontSize: 16, fontWeight: "800", },
  subtitle: { color: colors.muted, fontSize: 15, marginBottom: 8 },
  picks: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  pick: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#ffffff",
  },
  pickOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  pickText: { color: colors.ink, fontWeight: "700", },
  pickTextOn: { color: "#ffffff" },
  agendaList: { gap: 10 },
  agenda: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    overflow: "hidden",
  },
  agendaDate: {
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    backgroundColor: "rgba(15,23,42,0.04)",
    gap: 1,
  },
  agendaDateToday: { backgroundColor: colors.orange },
  agendaDateText: { color: "#ffffff" },
  agendaWeekday: { color: colors.muted, fontSize: 12, fontWeight: "800", },
  agendaNum: { color: colors.ink, fontSize: 28, fontWeight: "800", lineHeight: 32 },
  agendaMonth: { color: colors.muted, fontSize: 12, fontWeight: "700", },
  agendaToday: { color: "#ffffff", fontSize: 11, fontWeight: "800", marginTop: 2, },
  agendaBody: { flex: 1, minWidth: 0, paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  agendaEmpty: { color: colors.muted, },
  line: { gap: 4 },
  lineChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lineChipText: { fontSize: 12, fontWeight: "800", },
  lineNames: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  extraRow: { flexDirection: "row", gap: 12, marginTop: 2 },
  extra: { flexDirection: "row", alignItems: "center", gap: 2 },
  extraParking: { color: "#0d47a1", fontWeight: "800" },
  extraMeeting: { color: "#004d40", fontWeight: "800" },
  openMonth: { alignSelf: "flex-start", marginBottom: 12 },
  openMonthText: { color: colors.orange, fontWeight: "800", },
  loader: { marginVertical: 24 },
  error: { color: colors.danger, marginBottom: 12 },
  dayToday: { borderColor: colors.orange, backgroundColor: "rgba(249,115,22,0.08)" },
  dayMissing: { borderColor: "rgba(239,68,68,0.55)", backgroundColor: "rgba(239,68,68,0.06)" },
  dayNumToday: { color: colors.orange },
  missing: { color: "#b91c1c", fontSize: 12, fontWeight: "700", marginTop: 8 },
  managers: { color: "#15803d", fontSize: 12, fontWeight: "700", marginTop: 8 },
  weekHead: { flexDirection: "row" },
  weekLetter: { width: "14.28%", textAlign: "center", color: colors.muted, fontWeight: "800", },
  weekRow: { flexDirection: "row" },
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
  monthNum: { color: colors.ink, fontSize: 13, fontWeight: "800", },
  miniCount: { fontSize: 11, fontWeight: "800" },
  rosterScreen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, },
  rosterHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  rosterTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", flex: 1, },
  rosterList: { paddingBottom: 24 },
  emptyDay: { color: colors.muted, marginTop: 12 },
  group: { marginBottom: 16 },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  groupTitle: { fontWeight: "800", fontSize: 16 },
  groupCount: { fontWeight: "800" },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
    borderRightWidth: 4,
  },
  personBody: { flex: 1, minWidth: 0 },
  personName: { color: colors.ink, fontWeight: "700", },
  personNote: { color: colors.muted, marginTop: 2 },
  aiTag: { color: colors.violet, fontSize: 12, fontWeight: "800", marginTop: 2 },
  rowActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  notice: { color: "#15803d", fontWeight: "700", marginBottom: 8 },
  form: { paddingBottom: 24, gap: 8 },
  fieldLabel: { color: colors.ink, fontWeight: "800", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  hoursInput: { writingDirection: "ltr", textAlign: "left" },
  noteInput: { minHeight: 80, textAlignVertical: "top" },
  choice: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceOn: { borderColor: colors.orange, backgroundColor: "rgba(249,115,22,0.1)" },
  choiceText: { color: colors.ink, fontWeight: "700" },
  saveButton: {
    marginTop: 8,
    backgroundColor: colors.orange,
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 14,
  },
  saveButtonOff: { opacity: 0.45 },
  saveText: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
  footer: {
    marginTop: 22,
    textAlign: "center",
    writingDirection: "ltr",
    color: colors.muted,
    fontStyle: "italic",
    fontSize: 16,
  },
});
