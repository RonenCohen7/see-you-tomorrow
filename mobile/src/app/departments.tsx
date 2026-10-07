import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

type Dept = {
  id: string;
  name: string;
  description?: string;
  accentColor?: string;
  isActive: boolean;
};

const SWATCHES = ["#f97316", "#ef4444", "#0ea5e9", "#7c4dff", "#22c55e", "#0f172a"];

function validHex(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export default function DepartmentsScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const canWrite = user?.role === "admin";
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Dept[]>([]);
  const [editor, setEditor] = useState<{ id: string | null; name: string; description: string; accentColor: string } | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = activeOnly ? "?isActive=true" : "";
      const data = await api<{ items: Dept[] }>(`/api/departments${qs}`);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "לא ניתן לטעון מחלקות");
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    if (status === "signedIn") void load();
  }, [status, load]);

  async function save() {
    if (!editor || !editor.name.trim()) return;
    const accent = editor.accentColor.trim();
    if (accent && !validHex(accent)) {
      setError("צבע הכותרת צריך להיות בפורמט #RRGGBB");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: { name: string; description?: string; accentColor?: string } = {
        name: editor.name.trim(),
        description: editor.description.trim() || undefined,
      };
      if (accent) payload.accentColor = accent;
      else if (editor.id) payload.accentColor = "";
      if (editor.id) await api(`/api/departments/${editor.id}`, { method: "PUT", body: payload });
      else await api("/api/departments", { method: "POST", body: payload });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת המחלקה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  function deactivate(dept: Dept) {
    Alert.alert("מחלקה", `לסמן את המחלקה «${dept.name}» כלא פעילה?`, [
      { text: "ביטול", style: "cancel" },
      {
        text: "סימון כלא פעילה",
        style: "destructive",
        onPress: () => {
          void api(`/api/departments/${dept.id}`, { method: "DELETE" })
            .then(() => load())
            .catch((err: unknown) => setError(err instanceof Error ? err.message : "הפעולה נכשלה"));
        },
      },
    ]);
  }

  async function activate(dept: Dept) {
    try {
      await api(`/api/departments/${dept.id}`, { method: "PUT", body: { isActive: true } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפעלת המחלקה נכשלה");
    }
  }

  if (status === "signedOut") return <Redirect href="/login" />;
  if (user && !canOpen(user.role, "departments")) return <Redirect href="/home" />;

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={user ? `שלום, ${user.fullName}` : undefined} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <View style={styles.titleRow}>
          <MaterialIcons name="apartment" size={26} color={colors.orange} />
          <Text style={styles.title}>מחלקות</Text>
          <View style={styles.count}>
            <Text style={styles.countText}>
              {items.length} סה״כ
            </Text>
          </View>
        </View>

        <View style={styles.tools}>
          <View style={styles.switchRow}>
            <Switch value={activeOnly} onValueChange={setActiveOnly} trackColor={{ true: colors.orange }} />
            <Text style={styles.switchLabel}>פעילים בלבד</Text>
          </View>
          {canWrite ? (
            <Pressable
              onPress={() => setEditor({ id: null, name: "", description: "", accentColor: "" })}
              style={styles.add}
            >
              <MaterialIcons name="add-circle" size={28} color="#ffffff" />
            </Pressable>
          ) : null}
        </View>

        {loading ? <ActivityIndicator color={colors.orange} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && items.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="apartment" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>{activeOnly ? "אין מחלקות פעילות להצגה" : "אין מחלקות עדיין"}</Text>
            {activeOnly ? (
              <Pressable onPress={() => setActiveOnly(false)}>
                <Text style={styles.link}>הצג את כל המחלקות</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          items.map((dept) => (
            <Pressable key={dept.id} onPress={() => router.push(`/department/${dept.id}`)} style={styles.card}>
              <View style={[styles.accent, { backgroundColor: dept.accentColor || colors.orange }]} />
              <View style={styles.avatar}>
                <MaterialIcons name="apartment" size={32} color={colors.orange} />
              </View>
              <Text style={styles.name}>{dept.name}</Text>
              <Text style={styles.description}>{dept.description?.trim() || "אין תיאור"}</Text>
              <View style={[styles.badge, dept.isActive ? styles.badgeOn : styles.badgeOff]}>
                <Text style={[styles.badgeText, dept.isActive ? styles.badgeTextOn : styles.badgeTextOff]}>
                  {dept.isActive ? "פעיל" : "לא פעיל"}
                </Text>
              </View>
              <Text style={styles.assignHint}>שיוך עובדים</Text>
              {canWrite ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() =>
                      setEditor({
                        id: dept.id,
                        name: dept.name,
                        description: dept.description ?? "",
                        accentColor: validHex(dept.accentColor ?? "") ? dept.accentColor! : "",
                      })
                    }
                    hitSlop={8}
                  >
                    <MaterialIcons name="edit" size={22} color={colors.orange} />
                  </Pressable>
                  {dept.isActive ? (
                    <Pressable onPress={() => deactivate(dept)} hitSlop={8}>
                      <MaterialIcons name="delete-outline" size={22} color={colors.red} />
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => void activate(dept)} hitSlop={8}>
                      <Text style={styles.link}>הפעל</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={!!editor} animationType="slide" transparent onRequestClose={() => setEditor(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.modalTitle}>{editor?.id ? "עריכה" : "מחלקה חדשה"}</Text>
            <Text style={styles.fieldLabel}>שם</Text>
            <TextInput
              value={editor?.name ?? ""}
              onChangeText={(name) => setEditor((current) => (current ? { ...current, name } : current))}
              style={styles.input}
              textAlign="right"
            />
            <Text style={styles.fieldLabel}>תיאור</Text>
            <TextInput
              value={editor?.description ?? ""}
              onChangeText={(description) => setEditor((current) => (current ? { ...current, description } : current))}
              style={[styles.input, styles.inputTall]}
              textAlign="right"
              multiline
            />
            <Text style={styles.fieldLabel}>צבע כותרת</Text>
            <View style={styles.swatches}>
              {SWATCHES.map((swatch) => (
                <Pressable
                  key={swatch}
                  onPress={() => setEditor((current) => (current ? { ...current, accentColor: swatch } : current))}
                  style={[styles.swatch, { backgroundColor: swatch }, editor?.accentColor === swatch && styles.swatchOn]}
                />
              ))}
            </View>
            <TextInput
              value={editor?.accentColor ?? ""}
              onChangeText={(accentColor) => setEditor((current) => (current ? { ...current, accentColor } : current))}
              style={styles.hex}
              placeholder="#7C4DFF"
              placeholderTextColor={colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              textAlign="left"
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setEditor(null)} style={styles.cancel}>
                <Text style={styles.cancelText}>ביטול</Text>
              </Pressable>
              <Pressable onPress={() => void save()} disabled={saving || !editor?.name.trim()} style={styles.save}>
                <Text style={styles.saveText}>{saving ? "שומר…" : "שמירה"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 16, direction: "rtl" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", writingDirection: "rtl" },
  count: { backgroundColor: "rgba(15,23,42,0.06)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: colors.ink, fontWeight: "700", writingDirection: "rtl" },
  tools: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { color: colors.ink, writingDirection: "rtl" },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: { marginVertical: 24 },
  error: { color: colors.danger, textAlign: "right", writingDirection: "rtl", marginBottom: 12 },
  empty: { alignItems: "center", padding: 24, gap: 8 },
  emptyTitle: { color: colors.muted, fontSize: 16, writingDirection: "rtl", textAlign: "center" },
  link: { color: colors.orange, fontWeight: "800", writingDirection: "rtl" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    marginBottom: 12,
    overflow: "hidden",
    alignItems: "center",
    paddingBottom: 12,
  },
  accent: { height: 6, alignSelf: "stretch" },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginTop: 16,
    backgroundColor: "rgba(249,115,22,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: 10, writingDirection: "rtl", textAlign: "center" },
  description: {
    color: colors.muted,
    textAlign: "center",
    writingDirection: "rtl",
    marginTop: 4,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 8 },
  badgeOn: { backgroundColor: "rgba(34,197,94,0.16)" },
  badgeOff: { backgroundColor: "rgba(15,23,42,0.06)" },
  badgeText: { fontWeight: "800", writingDirection: "rtl" },
  badgeTextOn: { color: "#15803d" },
  badgeTextOff: { color: colors.muted },
  assignHint: { color: colors.orange, fontWeight: "700", marginTop: 8, writingDirection: "rtl" },
  actions: { flexDirection: "row", gap: 18, marginTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#ffffff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, direction: "rtl" },
  modalTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", textAlign: "right", writingDirection: "rtl" },
  fieldLabel: { color: colors.muted, marginTop: 12, textAlign: "right", writingDirection: "rtl" },
  input: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    marginTop: 6,
    color: colors.ink,
    writingDirection: "rtl",
  },
  inputTall: { minHeight: 88, textAlignVertical: "top", paddingTop: 10 },
  swatches: { flexDirection: "row", gap: 10, marginTop: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  swatchOn: { borderWidth: 3, borderColor: colors.ink },
  hex: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    marginTop: 10,
    color: colors.ink,
    writingDirection: "ltr",
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 },
  cancel: { paddingHorizontal: 12, paddingVertical: 10 },
  cancelText: { color: colors.muted, fontWeight: "700", writingDirection: "rtl" },
  save: { backgroundColor: colors.orange, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  saveText: { color: "#ffffff", fontWeight: "800", writingDirection: "rtl" },
});
