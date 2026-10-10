import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { hello, t } from "@/locale/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";

type Person = {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  departmentId?: string;
  isActive: boolean;
};

type Dept = { id: string; name: string; accentColor?: string; isActive?: boolean };

type FormState = {
  id: string | null;
  fullName: string;
  email: string;
  phone: string;
  departmentId: string;
  jobTitle: string;
};

const EMPTY: FormState = { id: null, fullName: "", email: "", phone: "", departmentId: "", jobTitle: "" };

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function avatarColor(seed: string): string {
  let hue = 0;
  for (let i = 0; i < seed.length; i++) hue = (hue * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${hue}, 65%, 45%)`;
}

function emailOk(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

async function loadPeople(): Promise<Person[]> {
  const all: Person[] = [];
  let page = 1;
  while (page < 30) {
    const data = await api<{ items: Person[]; total: number }>(
      `/api/employees?scope=company&page=${page}&limit=100&isActive=true`
    );
    all.push(...data.items);
    if (all.length >= data.total || data.items.length === 0) break;
    page += 1;
  }
  return all;
}

export default function EmployeesScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const role = user?.role?.trim().toLowerCase();
  const canWrite = role === "admin" || role === "manager";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const formScroll = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staff, depts] = await Promise.all([
        loadPeople(),
        api<{ items: Dept[] }>("/api/departments?isActive=true"),
      ]);
      setPeople(staff);
      setDepartments(depts.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("לא ניתן לטעון עובדים"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "signedIn") void load();
  }, [status, load]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function reveal(key: string) {
    setTimeout(() => {
      formScroll.current?.scrollTo({ y: Math.max(0, (fieldY.current[key] ?? 0) - 16), animated: true });
    }, Platform.OS === "ios" ? 280 : 60);
  }

  const deptName = useCallback(
    (id?: string) => departments.find((dept) => dept.id === id)?.name,
    [departments]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people
      .filter((person) => {
        if (!q) return true;
        const dept = deptName(person.departmentId) ?? "";
        return [person.fullName, person.email, person.phone, person.jobTitle, dept].some((value) =>
          (value ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "he"));
  }, [people, query, deptName]);

  const formReady =
    !!editor?.fullName.trim() &&
    emailOk(editor.email) &&
    !!editor.phone.trim() &&
    !!editor.departmentId &&
    !!editor.jobTitle.trim();

  async function save() {
    if (!editor || !formReady) return;
    setSaving(true);
    setError(null);
    const payload = {
      fullName: editor.fullName.trim(),
      email: editor.email.trim(),
      phone: editor.phone.trim(),
      departmentId: editor.departmentId,
      jobTitle: editor.jobTitle.trim(),
    };
    try {
      if (editor.id) await api(`/api/employees/${editor.id}`, { method: "PUT", body: payload });
      else await api("/api/employees", { method: "POST", body: payload });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("שמירת העובד נכשלה"));
    } finally {
      setSaving(false);
    }
  }

  if (status === "signedOut") return <Redirect href="/login" />;
  if (user && !canOpen(user.role, "employees")) return <Redirect href="/home" />;

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={user ? hello(user.fullName) : undefined} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <HomeLink />
        <View style={styles.titleRow}>
          <MaterialIcons name="groups" size={26} color={colors.orange} />
          <Text style={styles.title}>{t("עובדים")}</Text>
          <View style={styles.count}>
            <Text style={styles.countText}>{visible.length} {t("סה״כ")}</Text>
          </View>
          {canWrite ? (
            <Pressable onPress={() => setEditor(EMPTY)} style={styles.add}>
              <MaterialIcons name="add-circle" size={28} color="#ffffff" />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.tagline}>The right people, in the right place — every day.</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("חיפוש")}
          placeholderTextColor={colors.muted}
          style={styles.search}
         
        />
        {loading ? <ActivityIndicator color={colors.orange} style={styles.loader} /> : null}
        {error && !editor ? <Text style={styles.error}>{error}</Text> : null}
        {!loading && visible.length === 0 ? <Text style={styles.empty}>{t("אין עובדים להצגה")}</Text> : null}
        {visible.map((person) => {
          const accent = departments.find((dept) => dept.id === person.departmentId)?.accentColor;
          const bar = accent && /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : avatarColor(person.id);
          return (
            <Pressable
              key={person.id}
              onPress={() =>
                canWrite
                  ? setEditor({
                      id: person.id,
                      fullName: person.fullName,
                      email: person.email ?? "",
                      phone: person.phone ?? "",
                      departmentId: person.departmentId ?? "",
                      jobTitle: person.jobTitle ?? "",
                    })
                  : undefined
              }
              style={styles.card}
            >
              <View style={[styles.accent, { backgroundColor: bar }]} />
              <Text style={styles.name}>{person.fullName}</Text>
              {person.jobTitle ? <Text style={styles.meta}>{person.jobTitle}</Text> : null}
              {deptName(person.departmentId) ? <Text style={styles.meta}>{deptName(person.departmentId)}</Text> : null}
              <View style={[styles.avatar, { backgroundColor: bar }]}>
                <Text style={styles.avatarText}>{initials(person.fullName) || "S"}</Text>
              </View>
              {person.email ? <Text style={styles.ltr}>{person.email}</Text> : null}
              {person.phone ? <Text style={styles.ltr}>{person.phone}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={!!editor} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditor(null)}>
        <View style={[styles.formScreen, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.modalTitle}>{editor?.id ? t("עריכת עובד") : t("עובד חדש")}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ScrollView
            ref={formScroll}
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <View onLayout={(event) => { fieldY.current.name = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("שם מלא")}</Text>
              <TextInput
                value={editor?.fullName ?? ""}
                onChangeText={(fullName) => setEditor((current) => (current ? { ...current, fullName } : current))}
                onFocus={() => reveal("name")}
                style={styles.input}
               
                returnKeyType="next"
              />
            </View>
            <View onLayout={(event) => { fieldY.current.email = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("מייל")}</Text>
              <TextInput
                value={editor?.email ?? ""}
                onChangeText={(email) => setEditor((current) => (current ? { ...current, email } : current))}
                onFocus={() => reveal("email")}
                style={styles.ltrInput}
                textAlign="left"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>
            <View onLayout={(event) => { fieldY.current.phone = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("מספר נייד")}</Text>
              <TextInput
                value={editor?.phone ?? ""}
                onChangeText={(phone) => setEditor((current) => (current ? { ...current, phone } : current))}
                onFocus={() => reveal("phone")}
                style={styles.ltrInput}
                textAlign="left"
                keyboardType="phone-pad"
              />
            </View>
            <View onLayout={(event) => { fieldY.current.dept = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("מחלקה")}</Text>
              {departments.map((dept) => {
                const selected = editor?.departmentId === dept.id;
                return (
                  <Pressable
                    key={dept.id}
                    onPress={() => setEditor((current) => (current ? { ...current, departmentId: dept.id } : current))}
                    style={[styles.deptOption, selected && styles.deptOptionOn]}
                  >
                    <Text style={[styles.deptOptionText, selected && styles.deptOptionTextOn]}>{dept.name}</Text>
                  </Pressable>
                );
              })}
              {departments.length === 0 ? <Text style={styles.hint}>{t("אין מחלקות פעילות. צרו מחלקה קודם.")}</Text> : null}
            </View>
            <View onLayout={(event) => { fieldY.current.job = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("תפקיד")}</Text>
              <TextInput
                value={editor?.jobTitle ?? ""}
                onChangeText={(jobTitle) => setEditor((current) => (current ? { ...current, jobTitle } : current))}
                onFocus={() => reveal("job")}
                style={styles.input}
               
              />
            </View>
          </ScrollView>
          <View style={[styles.formFooter, { marginBottom: keyboardHeight, paddingBottom: keyboardHeight ? 10 : insets.bottom + 10 }]}>
            <Pressable onPress={() => { setError(null); setEditor(null); }} style={styles.cancel}>
              <Text style={styles.cancelText}>{t("ביטול")}</Text>
            </Pressable>
            <Pressable onPress={() => void save()} disabled={saving || !formReady} style={[styles.save, !formReady && styles.saveOff]}>
              <Text style={styles.saveText}>{saving ? t("שומר…") : t("שמירה")}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 16, },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", flex: 1, },
  count: { backgroundColor: "rgba(15,23,42,0.06)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: colors.ink, fontWeight: "700", },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  tagline: { color: colors.muted, writingDirection: "ltr", textAlign: "center", fontStyle: "italic", marginTop: 8, marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    color: colors.ink,
  },
  loader: { marginVertical: 24 },
  error: { color: colors.danger, marginBottom: 12 },
  empty: { color: colors.muted, },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    marginBottom: 12,
    overflow: "hidden",
    paddingBottom: 12,
    alignItems: "flex-end",
    paddingHorizontal: 14,
  },
  accent: { height: 4, alignSelf: "stretch", marginHorizontal: -14, marginBottom: 12 },
  name: { color: colors.ink, fontSize: 18, fontWeight: "800", },
  meta: { color: colors.muted, marginTop: 2 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    alignSelf: "flex-start",
  },
  avatarText: { color: "#ffffff", fontWeight: "800", fontSize: 18 },
  ltr: { alignSelf: "stretch", color: colors.muted, writingDirection: "ltr", textAlign: "left", marginTop: 6 },
  formScreen: { flex: 1, backgroundColor: "#ffffff", paddingHorizontal: 16, },
  formScroll: { flex: 1 },
  formContent: { paddingBottom: 24 },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  fieldLabel: { color: colors.muted, marginTop: 12, },
  hint: { color: colors.muted, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    marginTop: 6,
    color: colors.ink,
  },
  ltrInput: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    marginTop: 6,
    color: colors.ink,
    writingDirection: "ltr",
  },
  deptOption: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    backgroundColor: "#ffffff",
  },
  deptOptionOn: { borderColor: colors.orange, backgroundColor: "rgba(249,115,22,0.12)" },
  deptOptionText: { color: colors.ink, fontWeight: "700" },
  deptOptionTextOn: { color: colors.orange },
  formFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.08)",
    backgroundColor: "#ffffff",
  },
  cancel: { paddingHorizontal: 12, paddingVertical: 10 },
  cancelText: { color: colors.muted, fontWeight: "700", },
  save: { backgroundColor: colors.orange, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  saveOff: { opacity: 0.45 },
  saveText: { color: "#ffffff", fontWeight: "800", },
});
