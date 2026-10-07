import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

type RuleType =
  | "organization_policy"
  | "location_unavailable"
  | "min_managers_office_daily"
  | "manager_office_auto_parking";

type Rule = {
  id: string;
  ruleType: RuleType;
  payload: Record<string, unknown>;
  isActive: boolean;
  priority: number;
  createdAt?: string;
};

type Proposal = {
  id: string;
  ruleType: RuleType;
  payload: Record<string, unknown>;
  isActive: boolean;
  explanationHe: string;
};

type Draft = { ruleType: RuleType; payload: Record<string, unknown>; explanationHebrew: string };

type Place = { id: string; name: string };

const ORDER: RuleType[] = [
  "organization_policy",
  "location_unavailable",
  "min_managers_office_daily",
  "manager_office_auto_parking",
];

const TYPE_LABEL: Record<RuleType, string> = {
  organization_policy: "חוק ארגון",
  location_unavailable: "סגירת מיקום",
  min_managers_office_daily: "מנהלים במשרד ביום",
  manager_office_auto_parking: "חנייה אוטומטית למנהל במשרד",
};

const TYPE_INTRO: Record<RuleType, string> = {
  organization_policy: "החוק נשמר לארגון ומוצג כאן. השמירה לא תלויה במפתח AI.",
  location_unavailable: "חוסם שיבוץ משרד במיקום לטווח תאריכים באימות המלצות AI.",
  min_managers_office_daily: "דורש מינימום מנהלים במשרד ביום עבודה באימות של AI.",
  manager_office_auto_parking: "כשמנהל נשמר במשרד עם מיקום — המערכת מנסה להקצות חניית אורח.",
};

function impactOf(ruleType: RuleType) {
  if (ruleType === "manager_office_auto_parking") return "חנייה בשמירה";
  if (ruleType === "organization_policy") return "חוק ארגון";
  return "המלצות AI";
}

function messageOf(err: unknown) {
  return err instanceof ApiError && err.message ? err.message : "הפעולה נכשלה.";
}

function payloadText(rule: Pick<Rule, "ruleType" | "payload">, names: Map<string, string>) {
  const payload = rule.payload;
  if (rule.ruleType === "location_unavailable") {
    const id = typeof payload.locationId === "string" ? payload.locationId : "";
    const from = typeof payload.effectiveFrom === "string" ? payload.effectiveFrom : "";
    const to = typeof payload.effectiveTo === "string" ? payload.effectiveTo : "";
    const note = typeof payload.note === "string" ? payload.note : "";
    return [names.get(id) ?? id, to ? `${from} → ${to}` : from, note].filter(Boolean).join(" · ");
  }
  if (rule.ruleType === "min_managers_office_daily") {
    return typeof payload.minManagers === "number" ? String(payload.minManagers) : "";
  }
  if (rule.ruleType === "organization_policy") {
    return typeof payload.text === "string" ? payload.text.trim() : "";
  }
  return "התנהגות מערכת — אין פרמטרים בשורת החוק";
}

export default function SchedulingRulesScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const isAdmin = user?.role?.trim().toLowerCase() === "admin";
  const [rules, setRules] = useState<Rule[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [policy, setPolicy] = useState("");
  const [wizard, setWizard] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftActive, setDraftActive] = useState(true);
  const [maintenance, setMaintenance] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [pickingLocation, setPickingLocation] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState("");
  const [minManagers, setMinManagers] = useState("1");

  const names = useMemo(() => new Map(places.map((place) => [place.id, place.name])), [places]);
  const hasAutoParking = rules.some((rule) => rule.ruleType === "manager_office_auto_parking");

  async function reload() {
    const [ruleData, proposalData, placeData] = await Promise.all([
      api<{ items?: Rule[] }>("/api/schedules/scheduling-rules"),
      api<{ items?: Proposal[] }>("/api/schedules/scheduling-rules/proposals?status=pending"),
      api<{ items?: Place[] }>("/api/locations?isActive=true"),
    ]);
    setRules(Array.isArray(ruleData.items) ? ruleData.items : []);
    setProposals(Array.isArray(proposalData.items) ? proposalData.items : []);
    setPlaces(Array.isArray(placeData.items) ? placeData.items : []);
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await reload();
      } catch (err) {
        if (alive) setError(messageOf(err));
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
  if (!canOpen(user.role, "schedulingRules")) return <Redirect href="/home" />;

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await reload();
      if (ok) setNotice(ok);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  function removeRule(id: string) {
    Alert.alert("למחוק חוק?", "החוק יוסר מהמערכת. פעולה זו לא ניתנת לביטול.", [
      { text: "ביטול", style: "cancel" },
      {
        text: "מחיקה",
        style: "destructive",
        onPress: () => void run(() => api(`/api/schedules/scheduling-rules/${id}`, { method: "DELETE" }), "החוק נמחק."),
      },
    ]);
  }

  return (
    <View style={styles.screen}>
      <BrandHeader greeting="חוקי שיבוץ" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
        >
          <HomeLink />
          <Text style={styles.title}>חוקי שיבוץ והמלצות AI</Text>
          <Text style={styles.banner}>החוקים חלים על אישור המלצות AI. שמירה ידנית בלוח אינה נחסמת על ידם.</Text>
          {loading ? <ActivityIndicator color={colors.orange} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <View style={styles.card}>
            <Text style={styles.section}>הוספת חוק לארגון</Text>
            <Text style={styles.hint}>כתבו את החוק בשפה שלכם ושמרו. לא נדרש מפתח AI.</Text>
            <TextInput
              value={policy}
              onChangeText={setPolicy}
              placeholder="הפסקות מתנהלות רק בין 12:00 ל-14:00"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.area]}
              textAlign="right"
              multiline
              maxLength={500}
            />
            <Pressable
              disabled={busy || policy.trim().length < 3}
              onPress={() =>
                void run(async () => {
                  await api("/api/schedules/scheduling-rules", {
                    method: "POST",
                    body: { ruleType: "organization_policy", payload: { text: policy.trim() } },
                  });
                  setPolicy("");
                }, "החוק נשמר.")
              }
              style={({ pressed }) => [styles.primary, (busy || policy.trim().length < 3) && styles.disabled, pressed && styles.primaryPressed]}
            >
              <Text style={styles.primaryText}>שמור חוק</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>ממתין לאישור</Text>
          {proposals.length === 0 ? (
            <Text style={styles.hint}>אין הצעות חוק הממתינות לאישור.</Text>
          ) : (
            proposals.map((proposal) => (
              <View key={proposal.id} style={styles.card}>
                <Text style={styles.chip}>{TYPE_LABEL[proposal.ruleType]}</Text>
                <Text style={styles.body}>{proposal.explanationHe}</Text>
                <View style={styles.row}>
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      void run(
                        () => api(`/api/schedules/scheduling-rules/proposals/${proposal.id}/approve`, { method: "POST" }),
                        "החוק אושר ונשמר."
                      )
                    }
                    style={styles.primary}
                  >
                    <Text style={styles.primaryText}>אשר</Text>
                  </Pressable>
                  <Pressable
                    disabled={busy}
                    onPress={() =>
                      void run(
                        () => api(`/api/schedules/scheduling-rules/proposals/${proposal.id}/reject`, { method: "POST" }),
                        "ההצעה נדחתה."
                      )
                    }
                    style={styles.outline}
                  >
                    <Text style={styles.outlineText}>דחה</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <View style={styles.card}>
            <Text style={styles.section}>מה החוק הנדרש? (מתחילים כאן)</Text>
            <Text style={styles.hint}>
              תארו בקצרה מה תרצו — סגירת סניף, שני מנהלים במשרד בכל יום, או חנייה למנהלים במשרד.
            </Text>
            <TextInput
              value={wizard}
              onChangeText={(value) => {
                setWizard(value);
                setDraft(null);
                setMaintenance(null);
              }}
              placeholder="כתוב כאן בחופשיות…"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.area]}
              textAlign="right"
              multiline
            />
            <Pressable
              disabled={busy || wizard.trim().length < 3}
              onPress={() =>
                void run(async () => {
                  const data = await api<
                    | { outcome: "scheduling_rule"; draft: Draft }
                    | { outcome: "maintenance_action"; explanationHebrew: string }
                  >("/api/ai/draft-scheduling-rule", {
                    method: "POST",
                    body: { naturalText: wizard.trim(), locations: places.map((place) => ({ id: place.id, name: place.name })) },
                  });
                  if (data.outcome === "maintenance_action") {
                    setDraft(null);
                    setMaintenance(data.explanationHebrew);
                    setNotice("זוהתה פעולת תחזוקה.");
                    return;
                  }
                  setMaintenance(null);
                  setDraft(data.draft);
                  setNotice("החוק הוסק מהתיאור.");
                }, "")
              }
              style={({ pressed }) => [styles.primary, (busy || wizard.trim().length < 3) && styles.disabled, pressed && styles.primaryPressed]}
            >
              <Text style={styles.primaryText}>{busy ? "מנתח…" : "להסיק חוק מתיאור זה"}</Text>
            </Pressable>
            {maintenance ? (
              <View style={styles.warn}>
                <Text style={styles.body}>{maintenance}</Text>
                {isAdmin ? (
                  <Pressable
                    onPress={() =>
                      Alert.alert("לאשר מחיקת שיבוצים עתידיים?", "הפעולה מוחקת שיבוצים מהיום והלאה לעובדים לא פעילים.", [
                        { text: "ביטול", style: "cancel" },
                        {
                          text: "לבצע ניקוי",
                          style: "destructive",
                          onPress: () =>
                            void run(async () => {
                              await api("/api/schedules/admin/maintenance/inactive-employees-clear-future", { method: "POST" });
                              setMaintenance(null);
                              setWizard("");
                            }, "הניקוי בוצע."),
                        },
                      ])
                    }
                    style={styles.outline}
                  >
                    <Text style={styles.outlineText}>לבצע ניקוי</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.hint}>ניקוי שיבוצים של עובדים לא פעילים זמין למנהל מערכת.</Text>
                )}
              </View>
            ) : null}
            {draft ? (
              <View style={styles.preview}>
                <Text style={styles.sub}>החוק שנבנה</Text>
                <Text style={styles.body}>{draft.explanationHebrew}</Text>
                <Text style={styles.chip}>{TYPE_LABEL[draft.ruleType]} · {impactOf(draft.ruleType)}</Text>
                <Text style={styles.body}>{payloadText(draft, names)}</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>להפעיל מיד בתוקף</Text>
                  <Switch value={draftActive} onValueChange={setDraftActive} trackColor={{ true: colors.orange }} />
                </View>
                <Pressable
                  disabled={busy}
                  onPress={() =>
                    void run(async () => {
                      await api("/api/schedules/scheduling-rules/submit", {
                        method: "POST",
                        body: {
                          ruleType: draft.ruleType,
                          payload: draft.payload,
                          isActive: draftActive,
                          explanationHe: draft.explanationHebrew,
                          locations: places.map((place) => ({ id: place.id, name: place.name })),
                        },
                      });
                      setDraft(null);
                      setWizard("");
                    }, "החוק נשמר.")
                  }
                  style={styles.primary}
                >
                  <Text style={styles.primaryText}>שמור חוק</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <Pressable onPress={() => setHelpOpen((open) => !open)} style={styles.fold}>
            <Text style={styles.section}>הסבר מורחב</Text>
            <MaterialIcons name={helpOpen ? "expand-less" : "expand-more"} size={24} color={colors.muted} />
          </Pressable>
          {helpOpen ? (
            <Text style={styles.hint}>
              חוק יכול להיות מופעל או כבוי. חוק לא פעיל נשמר להיסטוריה ואינו נכלל באימות ההמלצות. אפשר ליצור כמה חוקים מאותו סוג.
            </Text>
          ) : null}

          <Text style={styles.section}>חוקים קיימים</Text>
          {!loading && rules.length === 0 ? <Text style={styles.hint}>אין עדיין חוקים.</Text> : null}
          {ORDER.map((ruleType) => {
            const group = rules.filter((rule) => rule.ruleType === ruleType);
            if (group.length === 0) return null;
            return (
              <View key={ruleType} style={styles.group}>
                <Text style={styles.sub}>{TYPE_LABEL[ruleType]}</Text>
                <Text style={styles.hint}>{TYPE_INTRO[ruleType]}</Text>
                {group.map((rule) => (
                  <View key={rule.id} style={styles.card}>
                    <Text style={styles.chip}>{impactOf(rule.ruleType)}</Text>
                    <Text style={styles.body}>{payloadText(rule, names)}</Text>
                    <View style={styles.ruleTools}>
                      <Pressable onPress={() => removeRule(rule.id)} hitSlop={8}>
                        <MaterialIcons name="delete-outline" size={22} color={colors.danger} />
                      </Pressable>
                      <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>בתוקף</Text>
                        <Switch
                          value={rule.isActive}
                          disabled={busy}
                          trackColor={{ true: colors.orange }}
                          onValueChange={(checked) =>
                            void run(
                              () =>
                                api(`/api/schedules/scheduling-rules/${rule.id}`, {
                                  method: "PATCH",
                                  body: { isActive: checked },
                                }),
                              checked ? "החוק בתוקף." : "החוק כובה."
                            )
                          }
                        />
                      </View>
                    </View>
                    <Text style={styles.meta}>עדיפות: {rule.priority}</Text>
                  </View>
                ))}
              </View>
            );
          })}

          <Pressable onPress={() => setAdvancedOpen((open) => !open)} style={styles.fold}>
            <Text style={styles.section}>טפסים מפורטים</Text>
            <MaterialIcons name={advancedOpen ? "expand-less" : "expand-more"} size={24} color={colors.muted} />
          </Pressable>
          {advancedOpen ? (
            <View style={styles.card}>
              <Text style={styles.sub}>מיקום לא זמין</Text>
              <Pressable onPress={() => setPickingLocation(true)} style={styles.input}>
                <Text style={styles.fieldText}>{names.get(locationId) ?? "בחירת מיקום"}</Text>
              </Pressable>
              <TextInput value={from} onChangeText={setFrom} placeholder="מתאריך 2026-10-07" placeholderTextColor={colors.muted} style={styles.input} textAlign="left" />
              <TextInput value={to} onChangeText={setTo} placeholder="עד תאריך (לא חובה)" placeholderTextColor={colors.muted} style={styles.input} textAlign="left" />
              <TextInput value={note} onChangeText={setNote} placeholder="הערה (לא חובה)" placeholderTextColor={colors.muted} style={styles.input} textAlign="right" />
              <Pressable
                disabled={busy || !locationId || from.trim().length < 8}
                onPress={() =>
                  void run(async () => {
                    await api("/api/schedules/scheduling-rules", {
                      method: "POST",
                      body: {
                        ruleType: "location_unavailable",
                        payload: {
                          locationId,
                          effectiveFrom: from.trim(),
                          ...(to.trim() ? { effectiveTo: to.trim() } : {}),
                          ...(note.trim() ? { note: note.trim() } : {}),
                        },
                      },
                    });
                    setLocationId("");
                    setFrom("");
                    setTo("");
                    setNote("");
                  }, "חוק הסגירה נשמר.")
                }
                style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
              >
                <Text style={styles.primaryText}>הוסף חוק סגירת מיקום</Text>
              </Pressable>

              <Text style={styles.sub}>מינימום מנהלים ביום</Text>
              <TextInput
                value={minManagers}
                onChangeText={setMinManagers}
                keyboardType="number-pad"
                style={styles.input}
                textAlign="right"
              />
              <Pressable
                disabled={busy}
                onPress={() =>
                  void run(
                    () =>
                      api("/api/schedules/scheduling-rules", {
                        method: "POST",
                        body: {
                          ruleType: "min_managers_office_daily",
                          payload: { minManagers: Math.min(50, Math.max(0, Number(minManagers) || 0)) },
                        },
                      }),
                    "חוק המנהלים נשמר."
                  )
                }
                style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
              >
                <Text style={styles.primaryText}>הוסף חוק מנהלים</Text>
              </Pressable>

              <Text style={styles.sub}>חנייה אוטומטית למנהל במשרד</Text>
              {hasAutoParking ? <Text style={styles.hint}>כבר קיים חוק מסוג זה. מחקו אותו לפני הוספה חדשה.</Text> : null}
              <Pressable
                disabled={busy || hasAutoParking}
                onPress={() =>
                  void run(
                    () =>
                      api("/api/schedules/scheduling-rules", {
                        method: "POST",
                        body: { ruleType: "manager_office_auto_parking", payload: {} },
                      }),
                    "חוק החנייה נשמר."
                  )
                }
                style={({ pressed }) => [styles.outline, (busy || hasAutoParking) && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.outlineText}>הוסף חוק חנייה אוטומטית</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickingLocation} animationType="slide" onRequestClose={() => setPickingLocation(false)}>
        <View style={[styles.picker, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <Pressable onPress={() => setPickingLocation(false)} style={styles.fold}>
            <Text style={styles.section}>מיקום</Text>
            <MaterialIcons name="close" size={22} color={colors.ink} />
          </Pressable>
          <ScrollView>
            {places.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => {
                  setLocationId(place.id);
                  setPickingLocation(false);
                }}
                style={styles.place}
              >
                <Text style={styles.body}>{place.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, direction: "rtl" },
  title: { color: colors.ink, fontSize: 26, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginBottom: 8 },
  banner: {
    color: colors.ink,
    backgroundColor: "rgba(14,165,233,0.12)",
    borderRadius: 12,
    padding: 10,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    padding: 14,
    marginTop: 12,
  },
  section: { color: colors.ink, fontSize: 18, fontWeight: "800", textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  sub: { color: colors.ink, fontWeight: "700", textAlign: "right", writingDirection: "rtl", marginTop: 14 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  body: { color: colors.ink, fontSize: 15, lineHeight: 22, textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    marginTop: 10,
    color: colors.ink,
    backgroundColor: "#ffffff",
    justifyContent: "center",
  },
  area: { minHeight: 96, textAlignVertical: "top", paddingTop: 10 },
  fieldText: { color: colors.ink, textAlign: "right", writingDirection: "rtl" },
  primary: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  primaryPressed: { backgroundColor: colors.orangePressed },
  primaryText: { color: "#ffffff", fontWeight: "800", writingDirection: "rtl" },
  outline: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  outlineText: { color: colors.ink, fontWeight: "800", writingDirection: "rtl" },
  pressed: { backgroundColor: "rgba(249,115,22,0.12)" },
  disabled: { opacity: 0.45 },
  row: { flexDirection: "row", gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  switchLabel: { color: colors.ink, fontWeight: "700", writingDirection: "rtl" },
  chip: {
    alignSelf: "flex-start",
    overflow: "hidden",
    color: colors.orange,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: "700",
    writingDirection: "rtl",
  },
  ruleTools: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  meta: { color: colors.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl", marginTop: 6 },
  fold: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  preview: { marginTop: 8 },
  warn: { marginTop: 10, backgroundColor: "#fff7ed", borderRadius: 12, padding: 10 },
  group: { marginTop: 4 },
  error: { color: colors.danger, textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  notice: { color: "#15803d", textAlign: "right", writingDirection: "rtl", marginTop: 8 },
  picker: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, direction: "rtl" },
  place: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
});
