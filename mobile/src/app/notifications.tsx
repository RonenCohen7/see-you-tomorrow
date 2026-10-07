import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";

type ScheduleContext = {
  employeeName: string;
  workDate: string;
  workDateEnd?: string;
  status: string;
  statusDisplayHe?: string;
  note?: string;
  updatedByName?: string;
};

type MeetingContext = {
  roomName: string;
  locationName: string;
  floor?: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
  title: string;
  organizerName: string;
  isUpdate?: boolean;
};

type Notice = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  readBy?: { userId: string }[];
  scheduleContext?: ScheduleContext;
  meetingContext?: MeetingContext;
};

const STATUS_COLOR: Record<string, string> = {
  office: "#0ea5e9",
  home: "#f97316",
  client: "#8b5cf6",
  vacation: "#22c55e",
  sick: "#ef4444",
  off: "#94a3b8",
};

const STATUS_LABEL: Record<string, string> = {
  office: "משרד",
  home: "בית",
  client: "מחוץ למשרד – לקוח",
  vacation: "חופשה",
  sick: "חופשת מחלה",
  off: "לא עובד",
};

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : "שגיאה";
}

function isRead(item: Notice, userId: string): boolean {
  return (item.readBy ?? []).some((row) => row.userId === userId);
}

function whenLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [list, count] = await Promise.all([
      api<{ items: Notice[]; total: number }>("/api/notifications?limit=80"),
      api<{ count: number }>("/api/notifications/unread-count"),
    ]);
    setItems(list.items);
    setUnread(count.count);
  }, []);

  useEffect(() => {
    if (status !== "signedIn" || !user || !canOpen(user.role, "notifications")) return;
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

  useEffect(() => {
    if (!user || !canOpen(user.role, "notifications")) return;
    const id = setInterval(() => {
      void load().catch(() => undefined);
    }, 12_000);
    return () => clearInterval(id);
  }, [user, load]);

  if (status === "signedOut") return <Redirect href="/login" />;
  if (!user) return null;
  if (!canOpen(user.role, "notifications")) return <Redirect href="/home" />;

  async function markRead(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/notifications/${id}/read`, { method: "PUT" });
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/notifications/read-all", { method: "PUT" });
      setNotice("כל ההתראות סומנו כנקראו.");
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    Alert.alert("לנקות את כל ההתראות?", "הפעולה מסירה את כל ההתראות מהרשימה ולא ניתנת לביטול.", [
      { text: "ביטול", style: "cancel" },
      {
        text: "נקה הכל",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            setError(null);
            try {
              await api("/api/notifications/mine", { method: "DELETE" });
              setNotice("היסטוריית ההתראות נוקתה.");
              await load();
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
      <BrandHeader greeting="התראות" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>התראות</Text>
          <Text style={styles.countChip}>{items.length} אירועים</Text>
          {unread > 0 ? <Text style={styles.unreadChip}>{unread} לא נקרא</Text> : null}
        </View>
        <View style={styles.actions}>
          <Pressable
            disabled={unread <= 0 || busy}
            onPress={() => void markAll()}
            style={[styles.outline, (unread <= 0 || busy) && styles.disabled]}
          >
            <Text style={styles.outlineText}>סמן הכל כנקרא</Text>
          </Pressable>
          <Pressable
            disabled={(items.length === 0 && unread <= 0) || busy}
            onPress={clearAll}
            style={[styles.dangerOutline, (items.length === 0 && unread <= 0) && styles.disabled]}
          >
            <Text style={styles.dangerText}>נקה הכל</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          עדכון שיבוץ מציג למי השינוי, לאיזה תאריך, איזה סטטוס, ומי עדכן.
        </Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.orange} style={{ marginTop: 24 }} /> : null}
        {!loading && items.length === 0 ? <Text style={styles.empty}>אין התראות להצגה.</Text> : null}
        {items.map((item) => {
          const read = isRead(item, user.id);
          const schedule = item.scheduleContext;
          const meeting = item.meetingContext;
          const statusColor = STATUS_COLOR[schedule?.status ?? ""] ?? colors.muted;
          const statusText = schedule?.statusDisplayHe?.trim() || STATUS_LABEL[schedule?.status ?? ""] || schedule?.status;
          const range =
            schedule?.workDateEnd && schedule.workDateEnd !== schedule.workDate
              ? `${schedule.workDate} – ${schedule.workDateEnd}`
              : schedule?.workDate;
          return (
            <View key={item.id} style={[styles.card, !read && styles.cardUnread]}>
              <View style={styles.cardHead}>
                <Text style={styles.when}>{whenLabel(item.createdAt)}</Text>
                <Text style={[styles.badge, read ? styles.badgeRead : styles.badgeUnread]}>{read ? "נקרא" : "לא נקרא"}</Text>
              </View>
              {!read ? (
                <Pressable disabled={busy} onPress={() => void markRead(item.id)} style={styles.readButton}>
                  <Text style={styles.readButtonText}>סמן כנקרא</Text>
                </Pressable>
              ) : null}
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.type === "schedule_update" && schedule ? (
                <View style={styles.details}>
                  <View style={styles.line}>
                    <MaterialIcons name="person" size={18} color={colors.muted} />
                    <Text style={styles.lineLabel}>שיבוץ עבור</Text>
                    <Text style={styles.lineValue}>{schedule.employeeName}</Text>
                  </View>
                  <View style={styles.line}>
                    <MaterialIcons name="event-note" size={18} color={colors.muted} />
                    <Text style={styles.lineLabel}>{schedule.workDateEnd && schedule.workDateEnd !== schedule.workDate ? "תאריכים" : "תאריך עבודה"}</Text>
                    <Text style={styles.lineDate}>{range}</Text>
                  </View>
                  <View style={styles.line}>
                    <Text style={styles.lineLabel}>סטטוס</Text>
                    <Text style={[styles.statusChip, { color: statusColor, borderColor: statusColor }]}>{statusText}</Text>
                  </View>
                  {schedule.updatedByName ? (
                    <View style={styles.line}>
                      <MaterialIcons name="edit-calendar" size={18} color={colors.muted} />
                      <Text style={styles.lineLabel}>עודכן על ידי</Text>
                      <Text style={styles.lineValue}>{schedule.updatedByName}</Text>
                    </View>
                  ) : null}
                  {schedule.note ? <Text style={styles.note}>הערה: {schedule.note}</Text> : null}
                  <Text style={styles.message}>{item.message}</Text>
                </View>
              ) : item.type === "meeting_invite" && meeting ? (
                <View style={styles.details}>
                  <Text style={styles.lineValue}>
                    {meeting.roomName} · {meeting.locationName}
                    {meeting.floor ? ` · קומה ${meeting.floor}` : ""}
                    {meeting.isUpdate ? " · עודכן" : ""}
                  </Text>
                  <Text style={styles.cardTitle}>{meeting.title}</Text>
                  <Text style={styles.lineDate}>
                    {meeting.workDate}
                    {meeting.hourStart != null || meeting.hourEnd != null
                      ? ` · ${meeting.hourStart ?? "—"}–${meeting.hourEnd ?? "—"}`
                      : " · יום מלא"}
                  </Text>
                  <Text style={styles.lineValue}>מארגן/ת: {meeting.organizerName}</Text>
                  <Text style={styles.message}>{item.message}</Text>
                </View>
              ) : (
                <Text style={styles.message}>{item.message}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12, direction: "rtl" },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  pageTitle: { color: colors.ink, fontSize: 26, fontWeight: "800", writingDirection: "rtl" },
  countChip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: colors.muted,
    fontWeight: "700",
    overflow: "hidden",
    writingDirection: "rtl",
  },
  unreadChip: {
    backgroundColor: "rgba(249,115,22,0.16)",
    color: colors.orangePressed,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontWeight: "800",
    overflow: "hidden",
    writingDirection: "rtl",
  },
  actions: { flexDirection: "row", gap: 8, marginBottom: 10 },
  outline: {
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.55)",
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  outlineText: { color: colors.ink, fontWeight: "800", writingDirection: "rtl" },
  dangerOutline: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  dangerText: { color: colors.danger, fontWeight: "800", writingDirection: "rtl" },
  disabled: { opacity: 0.4 },
  subtitle: { color: colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 22, marginBottom: 12 },
  notice: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: 12,
    padding: 12,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 10,
    overflow: "hidden",
  },
  error: {
    backgroundColor: colors.dangerBg,
    color: colors.danger,
    borderRadius: 12,
    padding: 12,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 10,
    overflow: "hidden",
  },
  empty: { color: colors.muted, textAlign: "right", writingDirection: "rtl", marginTop: 12 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12,
  },
  cardUnread: { borderColor: "rgba(249,115,22,0.45)", backgroundColor: "rgba(249,115,22,0.05)" },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  when: { color: colors.muted, fontWeight: "700", writingDirection: "rtl" },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, overflow: "hidden", fontWeight: "800", writingDirection: "rtl" },
  badgeUnread: { backgroundColor: colors.orange, color: "#ffffff" },
  badgeRead: { borderWidth: 1, borderColor: colors.line, color: colors.muted },
  readButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.orange,
    borderRadius: 20,
    paddingHorizontal: 12,
    minHeight: 34,
    justifyContent: "center",
  },
  readButtonText: { color: colors.orangePressed, fontWeight: "800", writingDirection: "rtl" },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  details: { marginTop: 8, gap: 8 },
  line: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  lineLabel: { color: colors.ink, fontWeight: "800", writingDirection: "rtl" },
  lineValue: { color: colors.ink, textAlign: "right", writingDirection: "rtl" },
  lineDate: { color: colors.ink, writingDirection: "ltr" },
  statusChip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 2,
    fontWeight: "800",
    overflow: "hidden",
    writingDirection: "rtl",
  },
  note: { color: colors.muted, textAlign: "right", writingDirection: "rtl" },
  message: { color: colors.muted, textAlign: "right", writingDirection: "rtl", lineHeight: 20, marginTop: 4 },
});
