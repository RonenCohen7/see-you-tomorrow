import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";
import { hello, t, tr } from "@/locale/i18n";

type Pref = "office" | "home" | "client" | "vacation" | "sick" | "off";
type PrefDay = { workDate: string; preference?: Pref };
type PrefDoc = { id: string; weekStartSunday: string; days: PrefDay[]; status: "draft" | "submitted" };
type Context = {
  preferenceMinDaysAhead: number;
  earliestAllowedWeekStartSunday: string;
  firstEditableDate?: string;
  preferenceRemindersEnabled: boolean;
};
type Pipeline = { departmentId?: string; pipelineStatus?: string; lastError?: string };

const OPTIONS: { key: Pref | ""; label: string; color: string }[] = [
  { key: "", label: "ללא העדפה", color: colors.muted },
  { key: "office", label: "משרד", color: "#0ea5e9" },
  { key: "home", label: "בית", color: "#f97316" },
  { key: "client", label: "מחוץ למשרד – לקוח", color: "#8b5cf6" },
  { key: "vacation", label: "חופשה", color: "#22c55e" },
  { key: "sick", label: "חופשת מחלה", color: "#ef4444" },
  { key: "off", label: "לא עובד", color: "#94a3b8" },
];

const PIPELINE: Record<string, string> = {
  queued: "ההגשה בתור לאיחוד המלצות המחלקה.",
  ai_running: "מתבצעת הפקת המלצות למחלקה.",
  ai_failed: "לא הושלמה המלצת AI.",
  awaiting_manager: "יש הצעת שיבוץ שממתינה לאישור מנהל.",
  applied: "השיבוץ אושר ופורסם בלוח.",
  rejected: "הצעת השיבוץ בוטלה.",
  superseded: "הופיעה הגשה חדשה והתור עודכן.",
};

const WEEKDAY = ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"];

function addUtcDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * 86400000).toISOString().slice(0, 10);
}

function weekday(iso: string): string {
  return t(WEEKDAY[new Date(`${iso}T12:00:00.000Z`).getUTCDay()] ?? "");
}

function labelFor(value: Pref | "" | undefined): string {
  return t(OPTIONS.find((option) => option.key === (value ?? ""))?.label ?? t("ללא העדפה"));
}

export default function PreferencesScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [week, setWeek] = useState("");
  const [days, setDays] = useState<PrefDay[]>([]);
  const [draft, setDraft] = useState<Record<string, Pref | "">>({});
  const [docStatus, setDocStatus] = useState<"draft" | "submitted" | "">("");
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  const loadWeek = useCallback(async (selected: string, keepEmpty: boolean) => {
    const [doc, pipe] = await Promise.all([
      api<PrefDoc>(`/api/schedules/preferences/attendance/week/${selected}`),
      api<Pipeline>(`/api/schedules/preferences/attendance/pipeline?weekStartSunday=${selected}`),
    ]);
    setDays(doc.days);
    setDocStatus(doc.status);
    setPipeline(pipe);
    if (!keepEmpty) {
      const next: Record<string, Pref | ""> = {};
      for (const row of doc.days) next[row.workDate] = row.preference ?? "";
      setDraft(next);
    }
  }, []);

  useEffect(() => {
    if (status !== "signedIn" || !user || !canOpen(user.role, "preferences")) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const context = await api<Context>("/api/schedules/preferences/context");
        if (cancelled) return;
        const options = Array.from({ length: 8 }, (_, index) => addUtcDays(context.earliestAllowedWeekStartSunday, index * 7));
        setCtx(context);
        setWeeks(options);
        setWeek(options[0] ?? "");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("לא ניתן לטעון העדפות"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, user]);

  useEffect(() => {
    if (!week || !user || !canOpen(user.role, "preferences")) return;
    let cancelled = false;
    (async () => {
      try {
        await loadWeek(week, cleared);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : t("לא ניתן לטעון את השבוע"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [week, user, loadWeek, cleared]);

  async function save(submit: boolean) {
    if (!week) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api("/api/schedules/preferences/attendance", {
        method: "PUT",
        body: {
          weekStartSunday: week,
          submit,
          days: days.map((day) => {
            const preference = draft[day.workDate];
            return preference ? { workDate: day.workDate, preference } : { workDate: day.workDate };
          }),
        },
      });
      if (submit) {
        const empty: Record<string, Pref | ""> = {};
        for (const day of days) empty[day.workDate] = "";
        setDraft(empty);
        setCleared(true);
        setNotice(t("הוגש בהצלחה"));
      } else {
        setCleared(false);
        setNotice(t("נשמר כטיוטה"));
      }
      await loadWeek(week, submit);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("השמירה נכשלה"));
    } finally {
      setBusy(false);
    }
  }

  if (status === "signedOut") return <Redirect href="/login" />;
  if (user && !canOpen(user.role, "preferences")) return <Redirect href="/home" />;

  const firstEditable = ctx?.firstEditableDate ?? "";
  const locked = (iso: string) => !!firstEditable && iso < firstEditable;
  const canSave = !!week && days.some((day) => !locked(day.workDate)) && !busy;

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={user ? hello(user.fullName) : undefined} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <View style={styles.titleRow}>
          <MaterialIcons name="event-available" size={26} color={colors.orange} />
          <Text style={styles.title}>{t("העדפות נוכחות שבועית")}</Text>
        </View>
        <Text style={styles.subtitle}>{t("מלא לכל יום בסטטוס מועדף. הנתונים נשקלים בהמלצות, והאישור הסופי אצל המנהל.")}</Text>
        {ctx ? (
          <View style={styles.info}>
            <Text style={styles.infoText}>
              {tr(
                `ניתן למלא העדפות החל מ־${ctx.firstEditableDate ?? ctx.earliestAllowedWeekStartSunday} (מינימום ${ctx.preferenceMinDaysAhead} ימים מראש). ימים שעברו נעולים.`,
                `You can set preferences from ${ctx.firstEditableDate ?? ctx.earliestAllowedWeekStartSunday} (at least ${ctx.preferenceMinDaysAhead} days ahead). Past days are locked.`
              )}
              {ctx.preferenceRemindersEnabled ? t(" תזכורות אוטומטיות פעילות.") : ""}
            </Text>
          </View>
        ) : null}
        {loading ? <ActivityIndicator color={colors.orange} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Text style={styles.fieldLabel}>{t("שבוע")}</Text>
        <View style={styles.weeks}>
          {weeks.map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setCleared(false);
                setWeek(item);
                setDraft({});
              }}
              style={[styles.week, item === week && styles.weekOn]}
            >
              <Text style={[styles.weekText, item === week && styles.weekTextOn]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        {docStatus === "submitted" && pipeline && !pipeline.departmentId ? (
          <Text style={styles.warn}>{t("לחשבון לא שויכה מחלקה. ההעדפות נשמרות, בלי צינור אוטומטי למחלקה.")}</Text>
        ) : null}
        {docStatus === "submitted" && pipeline?.pipelineStatus ? (
          <Text style={styles.infoText}>
            {t(PIPELINE[pipeline.pipelineStatus]) ?? pipeline.pipelineStatus}
            {pipeline.pipelineStatus === "ai_failed" && pipeline.lastError ? ` ${pipeline.lastError}` : ""}
          </Text>
        ) : null}

        {days.map((day) => {
          const value = draft[day.workDate] ?? "";
          const isLocked = locked(day.workDate);
          const tone = OPTIONS.find((option) => option.key === value)?.color ?? colors.muted;
          return (
            <View key={day.workDate} style={styles.day}>
              <Text style={[styles.dayDate, isLocked && styles.locked]}>
                {day.workDate} · {weekday(day.workDate)}
              </Text>
              <Pressable disabled={isLocked} onPress={() => setPicking(day.workDate)} style={[styles.choice, isLocked && styles.choiceLocked]}>
                <Text style={[styles.choiceText, { color: tone }]}>{labelFor(value)}</Text>
                <MaterialIcons name="expand-more" size={22} color={colors.muted} />
              </Pressable>
              {isLocked ? <Text style={styles.lockedNote}>{t("נעול — היום עבר")}</Text> : null}
            </View>
          );
        })}

        <View style={styles.actions}>
          <Pressable disabled={!canSave} onPress={() => void save(false)} style={[styles.draft, !canSave && styles.off]}>
            <Text style={styles.draftText}>{t("שמור טיוטה")}</Text>
          </Pressable>
          <Pressable
            disabled={!canSave}
            onPress={() =>
              Alert.alert(t("לשלוח את ההעדפות?"), t("לאחר ההגשה המנהל יקבל התראה אם שויכה מחלקה, והנתונים ישמשו את המלצות השיבוץ."), [
                { text: t("ביטול"), style: "cancel" },
                { text: t("שליחה"), onPress: () => void save(true) },
              ])
            }
            style={[styles.send, !canSave && styles.off]}
          >
            <Text style={styles.sendText}>{busy ? t("שולח…") : t("שלח הגשה")}</Text>
          </Pressable>
        </View>
        {docStatus ? (
          <Text style={styles.status}>
            {tr("סטטוס נוכחי:", "Current status:")} {docStatus === "submitted" ? t("הוגש") : t("טיוטה")}
          </Text>
        ) : null}
        {cleared && docStatus === "submitted" ? (
          <Text style={styles.notice}>{t("השדות אופסו להצגה. ההגשה נשמרה במערכת.")}</Text>
        ) : null}
      </ScrollView>

      <Modal visible={!!picking} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(null)}>
          <View style={styles.sheet}>
            <Text style={styles.modalTitle}>{t("העדפה")}</Text>
            {OPTIONS.map((option) => (
              <Pressable
                key={t(option.label)}
                onPress={() => {
                  if (!picking) return;
                  setDraft((current) => ({ ...current, [picking]: option.key }));
                  setCleared(false);
                  setPicking(null);
                }}
                style={styles.option}
              >
                <Text style={[styles.optionText, { color: option.color }]}>{t(option.label)}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 16, },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800", flex: 1, },
  subtitle: { color: colors.muted, marginTop: 8, marginBottom: 12 },
  info: { backgroundColor: "rgba(14,165,233,0.12)", borderRadius: 12, padding: 12, marginBottom: 12 },
  infoText: { color: colors.ink, lineHeight: 20 },
  loader: { marginVertical: 16 },
  error: { color: colors.danger, marginBottom: 8 },
  notice: { color: "#15803d", marginBottom: 8 },
  warn: { color: "#b45309", marginBottom: 8 },
  fieldLabel: { color: colors.muted, marginBottom: 6 },
  weeks: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  week: { borderWidth: 1, borderColor: "rgba(15,23,42,0.12)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#ffffff" },
  weekOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  weekText: { color: colors.ink, fontWeight: "700" },
  weekTextOn: { color: "#ffffff" },
  day: { marginBottom: 12 },
  dayDate: { color: colors.ink, fontWeight: "700", },
  locked: { color: colors.muted },
  choice: {
    marginTop: 6,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  choiceLocked: { backgroundColor: "rgba(15,23,42,0.04)" },
  choiceText: { fontWeight: "800", },
  lockedNote: { color: colors.muted, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  draft: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.orange, alignItems: "center", justifyContent: "center" },
  draftText: { color: colors.orange, fontWeight: "800", },
  send: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  sendText: { color: "#ffffff", fontWeight: "800", },
  off: { opacity: 0.45 },
  status: { color: colors.muted, marginTop: 10 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(15,23,42,0.06)" },
  optionText: { fontWeight: "800", fontSize: 16 },
});
