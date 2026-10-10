import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";
import { intlTag, t, tr } from "@/locale/i18n";

type Pref = "office" | "home" | "client" | "vacation" | "sick" | "off";
type PrefDay = { workDate: string; preference?: Pref };
type DeptRow = {
  id: string;
  employeeId: string;
  weekStartSunday: string;
  days: PrefDay[];
  status: string;
  submittedAt?: string;
};
type Pipeline = {
  pipelineStatus: string | null;
  lastError?: string;
  aiBatchId?: string;
};
type Dept = { id: string; name: string };
type Person = { id: string; fullName: string };
type Exception = {
  kind: "preference_overridden" | "office_shortfall" | "office_over_capacity";
  date?: string;
  employeeId?: string;
  requestedStatus?: string;
  assignedStatus?: string;
  officeCount?: number;
  required?: number;
  capacity?: number;
};
type Proposed = { date: string; employeeId: string; recommendedStatus: string; reason?: string };
type Batch = {
  id: string;
  departmentId: string;
  locationId?: string;
  dateRange: { from: string; to: string };
  proposedItems: Proposed[];
  status: string;
  exceptions?: Exception[];
};

const STATUS: Record<string, string> = {
  office: "משרד",
  home: "בית",
  client: "לקוח",
  vacation: "חופשה",
  sick: "מחלה",
  off: "לא עובד",
};

const WEEKDAY = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "שבת"];

const PIPELINE_CHIP: Record<string, string> = {
  applied: "הושלם — פורסם ללוח",
  awaiting_manager: "ממתין לאישור מנהל",
  ai_failed: "ה-AI נעצר לפני השיבוץ",
  rejected: "בוטל על ידי מנהל",
  queued: "בתור לעיבוד",
  ai_running: "מתבצעת המלצת AI",
  superseded: "הוחלף בהגשה חדשה",
};

const PIPELINE_BODY: Record<string, string> = {
  queued: "ההגשות בתור. עיבוד ה-AI למחלקה מתחיל תוך כ־10 שניות מההגשה האחרונה.",
  ai_running: "מתבצעת הפקת המלצות למחלקה מההגשות לשבוע.",
  ai_failed: "לא הושלמה המלצת AI.",
  awaiting_manager: "יש הצעת שיבוץ מוכנה. נמצאו חריגים ולכן היא ממתינה לאישור.",
  applied: "השיבוץ אושר ופורסם בלוח.",
  rejected: "הצעת השיבוץ בוטלה. לא פורסם שינוי ללוח.",
  superseded: "הגיעה הגשה חדשה והתור עודכן.",
};

function addUtcDays(iso: string, delta: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) + delta * 86400000).toISOString().slice(0, 10);
}

function weekday(iso: string): string {
  return t(WEEKDAY[new Date(`${iso}T12:00:00.000Z`).getUTCDay()] ?? "");
}

function statusLabel(value?: string): string {
  if (!value) return "—";
  return t(STATUS[value] ?? value);
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : t("שגיאה");
}

function submittedLabel(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(intlTag(), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function exceptionText(item: Exception, names: Map<string, string>): string {
  const who = item.employeeId ? names.get(item.employeeId) || t("עובד") : "";
  const when = item.date ? `${weekday(item.date)} ${item.date.slice(5)}` : "";
  if (item.kind === "preference_overridden") {
    return tr(
      `${who} · ${when}: ביקש/ה «${statusLabel(item.requestedStatus)}» ושובץ/ה «${statusLabel(item.assignedStatus)}»`,
      `${who} · ${when}: asked for “${statusLabel(item.requestedStatus)}” and was assigned “${statusLabel(item.assignedStatus)}”`
    );
  }
  if (item.kind === "office_shortfall") {
    return tr(
      `${when}: רק ${item.officeCount ?? 0} עובדים למשרד — המינימום ${item.required ?? 0}`,
      `${when}: only ${item.officeCount ?? 0} people in the office — minimum is ${item.required ?? 0}`
    );
  }
  if (item.kind === "office_over_capacity") {
    return tr(
      `${when}: שובצו ${item.officeCount ?? 0} למשרד — מעל הקיבולת (${item.capacity ?? 0})`,
      `${when}: ${item.officeCount ?? 0} assigned to the office — over capacity (${item.capacity ?? 0})`
    );
  }
  return "";
}

export default function TeamPreferencesScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.role?.trim().toLowerCase() === "admin";
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [deptId, setDeptId] = useState("");
  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState("");
  const [rows, setRows] = useState<DeptRow[]>([]);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [picker, setPicker] = useState<null | "dept" | "week">(null);

  const loadWeek = useCallback(async (departmentId: string, selectedWeek: string) => {
    if (!departmentId || !selectedWeek) {
      setRows([]);
      setPipeline(null);
      setBatch(null);
      setPeople([]);
      return;
    }
    const [submitted, pipe, staff, pending] = await Promise.all([
      api<{ items: DeptRow[] }>(
        `/api/schedules/preferences/attendance/dept?departmentId=${encodeURIComponent(departmentId)}&weekStartSunday=${encodeURIComponent(selectedWeek)}`
      ),
      api<Pipeline>(
        `/api/schedules/preferences/attendance/dept-pipeline?departmentId=${encodeURIComponent(departmentId)}&weekStartSunday=${encodeURIComponent(selectedWeek)}`
      ),
      (async () => {
        const all: Person[] = [];
        let page = 1;
        while (page < 20) {
          const data = await api<{ items: Person[]; total: number }>(
            `/api/employees?page=${page}&limit=100&departmentId=${encodeURIComponent(departmentId)}`
          );
          all.push(...data.items);
          if (all.length >= data.total || data.items.length === 0) break;
          page += 1;
        }
        return { items: all };
      })(),
      api<{ items: Batch[] }>("/api/schedules/ai-batches/pending-pipeline"),
    ]);
    setRows(submitted.items);
    setPipeline(pipe);
    setPeople(staff.items);
    const match =
      pending.items.find((item) => item.id === pipe.aiBatchId) ??
      pending.items.find((item) => item.departmentId === departmentId && item.dateRange.from === selectedWeek) ??
      null;
    setBatch(match);
  }, []);

  useEffect(() => {
    if (status !== "signedIn" || !user || !canOpen(user.role, "teamPreferences")) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const context = await api<{ earliestAllowedWeekStartSunday: string }>("/api/schedules/preferences/context");
        const options = Array.from({ length: 8 }, (_, index) => addUtcDays(context.earliestAllowedWeekStartSunday, index * 7));
        let places: Dept[] = [];
        if (isAdmin) {
          const data = await api<{ items: Dept[] }>("/api/departments?isActive=true");
          places = data.items;
        }
        if (cancelled) return;
        setDepartments(places);
        setWeeks(options);
        setWeek(options[0] ?? "");
        setDeptId(isAdmin ? places[0]?.id ?? "" : user.departmentId ?? "");
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, user, isAdmin]);

  useEffect(() => {
    if (!deptId || !week || !user || !canOpen(user.role, "teamPreferences")) return;
    let cancelled = false;
    (async () => {
      try {
        await loadWeek(deptId, week);
        if (!cancelled) setError(null);
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deptId, week, user, loadWeek]);

  useEffect(() => {
    const live = pipeline?.pipelineStatus === "queued" || pipeline?.pipelineStatus === "ai_running";
    if (!live || !deptId || !week) return;
    const id = setInterval(() => {
      void loadWeek(deptId, week).catch((err) => setError(errorText(err)));
    }, 10_000);
    return () => clearInterval(id);
  }, [pipeline?.pipelineStatus, deptId, week, loadWeek]);

  if (status === "signedOut") return <Redirect href="/login" />;
  if (!user) return null;
  if (!canOpen(user.role, "teamPreferences")) return <Redirect href="/home" />;

  const names = new Map(people.map((person) => [person.id, person.fullName]));
  const headerDays = rows[0]?.days ?? [];
  const rawStatus = pipeline?.pipelineStatus ?? null;
  const deptName = departments.find((dept) => dept.id === deptId)?.name;

  async function approve() {
    if (!batch?.locationId) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/ai/approve-recommendations", {
        method: "POST",
        body: {
          departmentId: batch.departmentId,
          locationId: batch.locationId,
          aiBatchId: batch.id,
          recommendations: batch.proposedItems.map((item) => ({
            date: item.date,
            employeeId: item.employeeId,
            recommendedStatus: item.recommendedStatus,
            ...(item.reason ? { reason: item.reason } : {}),
          })),
        },
      });
      setNotice(t("השיבוץ אושר ופורסם בלוח."));
      await loadWeek(deptId, week);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function reject() {
    if (!batch) return;
    Alert.alert(t("דחיית הצעה"), t("לדחות את ההצעה? העובדים יקבלו עדכון, והלוח לא ישתנה."), [
      { text: t("ביטול"), style: "cancel" },
      {
        text: t("דחייה"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await api(`/api/schedules/ai-batches/${batch.id}/reject-pipeline`, { method: "POST" });
              setNotice(t("ההצעה נדחתה."));
              await loadWeek(deptId, week);
            } catch (err) {
              setError(errorText(err));
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={t("העדפות צוות")} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <Text style={styles.subtitle}>
          {t("הגשות שהצוות שלח לשבוע שנבחר. טיוטות לא מופיעות. כשיש חריגים, ההצעה ממתינה כאן לאישור או לדחייה.")}
          </Text>
        <View style={styles.info}>
          <Text style={styles.infoTitle}>{t("איך בקשה מגיעה לאישור?")}</Text>
          <Text style={styles.infoBody}>
            {t("אחרי «שלח הגשה» נפתח מחזור למחלקה. בלי חריגים השיבוץ מתפרסם לבד. עם חריגים הוא ממתין למנהל.")}
            </Text>
        </View>

        {loading ? <ActivityIndicator color={colors.orange} style={{ marginTop: 24 }} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {!loading && isAdmin ? (
          <Pressable onPress={() => setPicker("dept")} style={styles.field}>
            <Text style={styles.fieldText}>{deptName || t("בחרו מחלקה")}</Text>
            <MaterialIcons name="arrow-drop-down" size={22} color={colors.muted} />
          </Pressable>
        ) : null}
        {!loading && !isAdmin ? (
          <Text style={styles.locked}>
            {deptId ? t("מוצגת המחלקה שלך בלבד.") : t("אין מחלקה משויכת לחשבון — פנו למנהל המערכת.")}
          </Text>
        ) : null}
        {!loading && weeks.length > 0 ? (
          <Pressable onPress={() => setPicker("week")} style={styles.field}>
            <Text style={styles.fieldText}>{t("שבוע")} {week}</Text>
            <MaterialIcons name="arrow-drop-down" size={22} color={colors.muted} />
          </Pressable>
        ) : null}

        {deptId && week && rawStatus === null && rows.length > 0 ? (
          <View style={styles.warnBox}>
            <Text style={styles.warnTitle}>{t("אין עדיין מחזור לשבוע זה")}</Text>
            <Text style={styles.warnBody}>{t("יש הגשות, אבל הצינור למחלקה לא נפתח. בדרך כלל העובד לא היה משויך למחלקה בזמן השליחה.")}</Text>
          </View>
        ) : null}

        {rawStatus ? (
          <View style={[styles.statusBox, rawStatus === "applied" && styles.statusOk, rawStatus === "awaiting_manager" && styles.statusWait]}>
            <Text style={styles.chip}>{t(PIPELINE_CHIP[rawStatus]) ?? rawStatus}</Text>
            <Text style={styles.statusBody}>{t(PIPELINE_BODY[rawStatus]) ?? ""}</Text>
            {rawStatus === "ai_failed" && pipeline?.lastError ? <Text style={styles.statusBody}>{pipeline.lastError}</Text> : null}
          </View>
        ) : null}

        {batch && batch.status === "pending_manager" ? (
          <View style={styles.approveCard}>
            <Text style={styles.approveTitle}>
              {tr(
                `בקשת אישור · ${batch.dateRange.from.slice(5)}–${batch.dateRange.to.slice(5)}`,
                `Approval request · ${batch.dateRange.from.slice(5)}–${batch.dateRange.to.slice(5)}`
              )}
            </Text>
            {!batch.locationId ? (
              <Text style={styles.warnBody}>{t("למחלקה חסר מיקום על ההצעה. אי אפשר לאשר עד שיוך המיקום יתוקן.")}</Text>
            ) : null}
            {(batch.exceptions ?? []).length > 0 ? (
              <View style={styles.exceptionBox}>
                <Text style={styles.exceptionTitle}>
                  {tr(`חריגים (${batch.exceptions!.length})`, `Exceptions (${batch.exceptions!.length})`)}
                </Text>
                {batch.exceptions!.map((item, index) => (
                  <Text key={`${item.kind}-${item.date}-${index}`} style={styles.exceptionLine}>
                    {exceptionText(item, names)}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.statusBody}>{t("לא נמצאו חריגים בהצעה זו.")}</Text>
            )}
            <View style={styles.actions}>
              <Pressable
                disabled={busy || !batch.locationId}
                onPress={() => void approve()}
                style={({ pressed }) => [styles.approveButton, (busy || !batch.locationId) && styles.disabled, pressed && styles.approvePressed]}
              >
                <Text style={styles.approveText}>{t("אישור והחלה")}</Text>
              </Pressable>
              <Pressable disabled={busy} onPress={reject} style={styles.rejectButton}>
                <Text style={styles.rejectText}>{t("דחייה")}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!deptId ? null : rows.length === 0 ? (
          <Text style={styles.empty}>{t("אין הגשות לשבוע זה במחלקה.")}</Text>
        ) : (
          rows.map((row) => (
            <View key={row.id} style={styles.personCard}>
              <Text style={styles.personName}>{names.get(row.employeeId) || t("עובד")}</Text>
              <Text style={styles.submitted}>{t("הוגש")} {submittedLabel(row.submittedAt)}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                {(headerDays.length > 0 ? headerDays : row.days).map((day) => {
                  const value = row.days.find((item) => item.workDate === day.workDate)?.preference;
                  return (
                    <View key={day.workDate} style={styles.dayCell}>
                      <Text style={styles.dayDate}>{day.workDate.slice(5)}</Text>
                      <Text style={styles.dayName}>{weekday(day.workDate)}</Text>
                      <Text style={styles.dayValue}>{statusLabel(value)}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{picker === "dept" ? t("מחלקה") : t("שבוע")}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {(picker === "dept" ? departments.map((dept) => ({ id: dept.id, label: dept.name })) : weeks.map((iso) => ({ id: iso, label: iso }))).map(
                (option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      if (picker === "dept") setDeptId(option.id);
                      else setWeek(option.id);
                      setPicker(null);
                      setNotice(null);
                    }}
                    style={styles.choice}
                  >
                    <Text style={styles.choiceText}>{t(option.label)}</Text>
                  </Pressable>
                )
              )}
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
  subtitle: { color: colors.muted, lineHeight: 22, marginBottom: 12 },
  info: { backgroundColor: "#e0f2fe", borderRadius: 14, padding: 12, marginBottom: 12 },
  infoTitle: { color: "#0c4a6e", fontWeight: "800", marginBottom: 4 },
  infoBody: { color: "#0c4a6e", lineHeight: 20 },
  error: {
    backgroundColor: colors.dangerBg,
    color: colors.danger,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  notice: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  field: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldText: { color: colors.ink, fontWeight: "700", },
  locked: { color: colors.muted, marginBottom: 10 },
  warnBox: { backgroundColor: "#fff7ed", borderRadius: 14, padding: 12, marginBottom: 12 },
  warnTitle: { color: "#9a3412", fontWeight: "800", },
  warnBody: { color: "#9a3412", marginTop: 4, lineHeight: 20 },
  statusBox: { backgroundColor: "#f8fafc", borderRadius: 14, padding: 12, marginBottom: 12, borderRightWidth: 4, borderRightColor: colors.sky },
  statusOk: { backgroundColor: "#dcfce7", borderRightColor: "#16a34a" },
  statusWait: { backgroundColor: "#e0f2fe", borderRightColor: colors.sky },
  chip: { alignSelf: "flex-start", fontWeight: "800", color: colors.ink, marginBottom: 4 },
  statusBody: { color: colors.ink, lineHeight: 20 },
  approveCard: { backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 12 },
  approveTitle: { color: colors.ink, fontWeight: "800", fontSize: 17, marginBottom: 8 },
  exceptionBox: { backgroundColor: colors.dangerBg, borderRadius: 12, padding: 10, marginBottom: 10 },
  exceptionTitle: { color: colors.danger, fontWeight: "800", marginBottom: 4 },
  exceptionLine: { color: colors.danger, lineHeight: 20, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  approveButton: { flex: 1, backgroundColor: "#16a34a", borderRadius: 12, minHeight: 44, alignItems: "center", justifyContent: "center" },
  approvePressed: { backgroundColor: "#15803d" },
  approveText: { color: "#ffffff", fontWeight: "800", },
  rejectButton: { flex: 1, borderWidth: 1, borderColor: "#f59e0b", borderRadius: 12, minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff" },
  rejectText: { color: "#b45309", fontWeight: "800", },
  disabled: { opacity: 0.45 },
  empty: { color: colors.muted, marginTop: 8 },
  personCard: { backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12, marginBottom: 10 },
  personName: { color: colors.ink, fontWeight: "800", fontSize: 17, },
  submitted: { color: colors.muted, marginBottom: 8 },
  days: { flexDirection: "row", gap: 8 },
  dayCell: { width: 72, borderRadius: 12, backgroundColor: "#f8fafc", padding: 8, alignItems: "center" },
  dayDate: { color: colors.ink, fontWeight: "800" },
  dayName: { color: colors.muted, fontSize: 12 },
  dayValue: { color: colors.ink, fontWeight: "700", marginTop: 4, textAlign: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  choice: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  choiceText: { color: colors.ink, fontWeight: "600" },
});
