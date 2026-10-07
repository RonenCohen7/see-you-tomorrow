import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";

type OrgSettings = {
  managerCanEditSchedules: boolean;
  preferenceMinDaysAhead: number;
  preferenceRemindersEnabled: boolean;
  disabledBuiltinScheduleStatuses?: string[];
  customScheduleStatuses: { id: string; labelHe: string; labelEn?: string; disabled?: boolean }[];
};

type CustomRow = { id: string; labelHe: string; labelEn: string; disabled: boolean };

const BUILTIN: { key: string; label: string }[] = [
  { key: "office", label: "משרד" },
  { key: "home", label: "בית" },
  { key: "client", label: "מחוץ למשרד – לקוח" },
  { key: "vacation", label: "חופשה" },
  { key: "sick", label: "חופשת מחלה" },
  { key: "off", label: "לא עובד" },
];

const SEVERITIES = [
  { id: "info", label: "מידע" },
  { id: "warning", label: "אזהרה" },
  { id: "error", label: "שגיאה" },
] as const;

function messageOf(err: unknown, fallback: string) {
  return err instanceof ApiError && err.message ? err.message : fallback;
}

export default function SettingsScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [prefDays, setPrefDays] = useState("0");
  const [disabledBuiltins, setDisabledBuiltins] = useState<string[]>([]);
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [bcTitle, setBcTitle] = useState("");
  const [bcMessage, setBcMessage] = useState("");
  const [bcSeverity, setBcSeverity] = useState<(typeof SEVERITIES)[number]["id"]>("info");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await api<OrgSettings>("/api/schedules/org-settings");
        if (!alive) return;
        setOrg(data);
        setPrefDays(String(data.preferenceMinDaysAhead ?? 0));
        setDisabledBuiltins([...(data.disabledBuiltinScheduleStatuses ?? [])]);
        setCustom(
          (data.customScheduleStatuses ?? []).map((row) => ({
            id: row.id,
            labelHe: row.labelHe,
            labelEn: row.labelEn ?? "",
            disabled: row.disabled === true,
          }))
        );
      } catch (err) {
        if (alive) setError(messageOf(err, "לא ניתן לטעון הגדרות."));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (status === "signedOut") return <Redirect href="/login" />;
  if (!user) return null;
  if (!canOpen(user.role, "settings")) return <Redirect href="/home" />;

  async function patch(body: Record<string, unknown>, ok: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await api<OrgSettings>("/api/schedules/org-settings", { method: "PATCH", body });
      setOrg(updated);
      setPrefDays(String(updated.preferenceMinDaysAhead ?? 0));
      setDisabledBuiltins([...(updated.disabledBuiltinScheduleStatuses ?? [])]);
      setCustom(
        (updated.customScheduleStatuses ?? []).map((row) => ({
          id: row.id,
          labelHe: row.labelHe,
          labelEn: row.labelEn ?? "",
          disabled: row.disabled === true,
        }))
      );
      setNotice(ok);
    } catch (err) {
      setError(messageOf(err, "השמירה נכשלה."));
    } finally {
      setSaving(false);
    }
  }

  async function saveStatuses() {
    if (custom.some((row) => !row.labelHe.trim())) {
      setError("לכל סטטוס נוסף חסרה כותרת בעברית.");
      return;
    }
    await patch(
      {
        disabledBuiltinScheduleStatuses: disabledBuiltins,
        customScheduleStatuses: custom.map((row) => {
          const labelHe = row.labelHe.trim();
          const labelEn = row.labelEn.trim();
          const base = row.id.trim() ? { id: row.id.trim(), labelHe } : { labelHe };
          const withEn = labelEn ? { ...base, labelEn } : base;
          return row.disabled ? { ...withEn, disabled: true } : withEn;
        }),
      },
      "הגדרות הסטטוסים נשמרו."
    );
  }

  async function sendBroadcast() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api("/api/notifications/admin/system-broadcast", {
        method: "POST",
        body: { title: bcTitle.trim(), message: bcMessage.trim(), severity: bcSeverity },
      });
      setBcTitle("");
      setBcMessage("");
      setBcSeverity("info");
      setNotice("ההודעה נשלחה.");
    } catch (err) {
      setError(messageOf(err, "לא ניתן לשדר."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <BrandHeader greeting="הגדרות" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
        >
          <HomeLink />
          <Text style={styles.title}>הגדרות</Text>
          {loading ? <ActivityIndicator color={colors.orange} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.card}>
            <Text style={styles.section}>ארגון</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>מנהלים רשאים לערוך משמרות</Text>
              <Switch
                value={!!org?.managerCanEditSchedules}
                disabled={!org || saving}
                trackColor={{ true: colors.orange }}
                onValueChange={(value) => void patch({ managerCanEditSchedules: value }, "עודכן.")}
              />
            </View>
            <Text style={styles.sub}>העדפות עובדים לפני AI</Text>
            <Text style={styles.label}>מינימום ימים קדימה להגשת העדפות</Text>
            <TextInput
              value={prefDays}
              onChangeText={setPrefDays}
              keyboardType="number-pad"
              style={styles.input}
              textAlign="right"
            />
            <Pressable
              disabled={saving}
              onPress={() => {
                const days = Math.min(60, Math.max(0, Number(prefDays) || 0));
                void patch({ preferenceMinDaysAhead: days }, "המרווח נשמר.");
              }}
              style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
            >
              <Text style={styles.outlineText}>שמור מרווח</Text>
            </Pressable>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>תזכורות אוטומטיות למלא העדפות</Text>
              <Switch
                value={!!org?.preferenceRemindersEnabled}
                disabled={!org || saving}
                trackColor={{ true: colors.orange }}
                onValueChange={(value) => void patch({ preferenceRemindersEnabled: value }, "עודכן.")}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>סטטוסים מוגדרים במערכת</Text>
            <Text style={styles.hint}>
              כבו «מוצג בבחירה» כדי להסתיר סטטוס ממשמרות חדשות, מלוח השנה ודוחות. רשומות קיימות נשארות עד שמעדכנים אותן.
            </Text>
            {BUILTIN.map((status) => {
              const shown = !disabledBuiltins.includes(status.key);
              return (
                <View key={status.key} style={styles.switchRow}>
                  <Text style={styles.switchLabel}>
                    {status.label} — מוצג בבחירות ודוחות
                  </Text>
                  <Switch
                    value={shown}
                    disabled={saving}
                    trackColor={{ true: colors.orange }}
                    onValueChange={(checked) =>
                      setDisabledBuiltins((prev) =>
                        checked ? prev.filter((key) => key !== status.key) : [...new Set([...prev, status.key])]
                      )
                    }
                  />
                </View>
              );
            })}

            <Text style={styles.sub}>סטטוסי משמרת נוספים</Text>
            <Text style={styles.hint}>אפשר לכבות סטטוס בלי למחוק את השם. משמרות שכבר הוגדרו יישארו.</Text>
            {custom.map((row, index) => (
              <View key={`${row.id}-${index}`} style={styles.custom}>
                <TextInput
                  value={row.labelHe}
                  onChangeText={(value) =>
                    setCustom((current) => current.map((item, i) => (i === index ? { ...item, labelHe: value } : item)))
                  }
                  placeholder="כותרת בעברית"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  textAlign="right"
                />
                <TextInput
                  value={row.labelEn}
                  onChangeText={(value) =>
                    setCustom((current) => current.map((item, i) => (i === index ? { ...item, labelEn: value } : item)))
                  }
                  placeholder="English (לא חובה)"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  textAlign="left"
                />
                <View style={styles.customTools}>
                  <Pressable onPress={() => setCustom((current) => current.filter((_, i) => i !== index))} hitSlop={8}>
                    <MaterialIcons name="delete-outline" size={22} color={colors.danger} />
                  </Pressable>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>בתוקף</Text>
                    <Switch
                      value={!row.disabled}
                      trackColor={{ true: colors.orange }}
                      onValueChange={(checked) =>
                        setCustom((current) =>
                          current.map((item, i) => (i === index ? { ...item, disabled: !checked } : item))
                        )
                      }
                    />
                  </View>
                </View>
              </View>
            ))}
            <Pressable
              disabled={custom.length >= 40 || saving}
              onPress={() => setCustom((current) => [...current, { id: "", labelHe: "", labelEn: "", disabled: false }])}
              style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
            >
              <Text style={styles.outlineText}>הוספת סטטוס</Text>
            </Pressable>
            <Pressable
              disabled={saving || custom.some((row) => !row.labelHe.trim())}
              onPress={() => void saveStatuses()}
              style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
            >
              <Text style={styles.primaryText}>{saving ? "שומר…" : "שמור הגדרות סטטוסים"}</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>חוקי שיבוץ</Text>
            <Text style={styles.hint}>סגירת מיקום, סף מנהלים ביום, והפעלה או כיבוי של כללי הארגון.</Text>
            <Pressable
              onPress={() => router.push("/scheduling-rules")}
              style={({ pressed }) => [styles.outline, pressed && styles.pressed]}
            >
              <Text style={styles.outlineText}>פתיחת דף חוקי שיבוץ</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.section}>הודעת מערכת</Text>
            <Text style={styles.hint}>שידור בזמן אמת למשתמשים מחוברים.</Text>
            <Text style={styles.label}>כותרת</Text>
            <TextInput value={bcTitle} onChangeText={setBcTitle} style={styles.input} textAlign="right" maxLength={120} />
            <Text style={styles.label}>הודעה</Text>
            <TextInput
              value={bcMessage}
              onChangeText={setBcMessage}
              style={[styles.input, styles.area]}
              textAlign="right"
              multiline
              maxLength={2000}
            />
            <Text style={styles.label}>חומרה</Text>
            <View style={styles.chips}>
              {SEVERITIES.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setBcSeverity(item.id)}
                  style={[styles.chip, bcSeverity === item.id && styles.chipOn]}
                >
                  <Text style={[styles.chipText, bcSeverity === item.id && styles.chipTextOn]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              disabled={saving || !bcTitle.trim() || !bcMessage.trim()}
              onPress={() => void sendBroadcast()}
              style={({ pressed }) => [
                styles.primary,
                (!bcTitle.trim() || !bcMessage.trim() || saving) && styles.disabled,
                pressed && styles.primaryPressed,
              ]}
            >
              <Text style={styles.primaryText}>שלח לכל המחוברים</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, direction: "rtl" },
  title: { color: colors.ink, fontSize: 26, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    padding: 14,
    marginBottom: 14,
  },
  section: { color: colors.ink, fontSize: 18, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  sub: { color: colors.ink, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginTop: 16 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  label: { color: colors.muted, fontSize: 13, textAlign: "right", writingDirection: "rtl", marginTop: 12, marginBottom: 6 },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: "#ffffff",
    writingDirection: "rtl",
  },
  area: { minHeight: 96, textAlignVertical: "top", paddingTop: 10 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  switchLabel: { flex: 1, color: colors.ink, fontSize: 15, textAlign: "right", writingDirection: "rtl" },
  custom: { marginTop: 12, gap: 8 },
  customTools: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  outline: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { color: colors.ink, fontWeight: "800", writingDirection: "rtl" },
  pressed: { backgroundColor: "rgba(249,115,22,0.12)" },
  primary: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryPressed: { backgroundColor: colors.orangePressed },
  primaryText: { color: "#ffffff", fontWeight: "800", writingDirection: "rtl" },
  disabled: { opacity: 0.45 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { color: colors.ink, fontWeight: "700", writingDirection: "rtl" },
  chipTextOn: { color: "#ffffff" },
  error: { color: colors.danger, textAlign: "right", writingDirection: "rtl", marginBottom: 8 },
  notice: { color: "#15803d", textAlign: "right", writingDirection: "rtl", marginBottom: 8 },
});
