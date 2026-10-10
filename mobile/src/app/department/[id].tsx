import { MaterialIcons } from "@expo/vector-icons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { hello, intlTag, t, tr } from "@/locale/i18n";
import { useLocale } from "@/locale/LocaleProvider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import { colors, roleLabel } from "@/ui/theme";

type Dept = { id: string; name: string; isActive: boolean };
type Person = {
  id: string;
  fullName: string;
  jobTitle?: string;
  role: string;
  departmentId?: string;
  isActive: boolean;
};

async function loadPeople(): Promise<Person[]> {
  const all: Person[] = [];
  let page = 1;
  while (page < 20) {
    const data = await api<{ items: Person[]; total: number }>(`/api/employees?page=${page}&limit=100&isActive=true`);
    all.push(...data.items);
    if (all.length >= data.total || data.items.length === 0) break;
    page += 1;
  }
  return all;
}

export default function DepartmentAssignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { status, user } = useAuth();
  const { locale } = useLocale();
  const insets = useSafeAreaInsets();
  const canAssign = user?.role === "admin";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [deptData, staff] = await Promise.all([
        api<{ items: Dept[] }>("/api/departments"),
        loadPeople(),
      ]);
      setDepartments(deptData.items);
      setPeople(staff);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("לא ניתן לטעון את המחלקה"));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (status === "signedIn") void load();
  }, [status, load]);

  const department = departments.find((item) => item.id === id);
  const deptName = (deptId?: string) => departments.find((item) => item.id === deptId)?.name;

  const members = useMemo(
    () => people.filter((person) => person.departmentId === id).sort((a, b) => a.fullName.localeCompare(b.fullName, "he")),
    [people, id]
  );
  const others = useMemo(() => {
    const q = query.trim();
    return people
      .filter((person) => person.departmentId !== id)
      .filter((person) => !q || person.fullName.includes(q))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, intlTag()));
  }, [people, id, query]);

  function assign(person: Person) {
    const current = deptName(person.departmentId);
    const next = department?.name ?? t("המחלקה");
    const message = current
      ? tr(
          `${person.fullName} משויך כרגע ל«${current}». להעביר אל «${next}»?`,
          `${person.fullName} is currently in “${current}”. Move them to “${next}”?`
        )
      : tr(`לשייך את ${person.fullName} אל «${next}»?`, `Assign ${person.fullName} to “${next}”?`);
    Alert.alert(t("שיוך למחלקה"), message, [
      { text: t("ביטול"), style: "cancel" },
      {
        text: t("שייך"),
        onPress: () => {
          setBusyId(person.id);
          void api(`/api/employees/${person.id}`, { method: "PUT", body: { departmentId: id } })
            .then(() => load())
            .catch((err: unknown) => setError(err instanceof Error ? err.message : t("השיוך נכשל")))
            .finally(() => setBusyId(null));
        },
      },
    ]);
  }

  if (status === "signedOut") return <Redirect href="/login" />;
  if (user && !canOpen(user.role, "departments")) return <Redirect href="/home" />;

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={user ? hello(user.fullName) : undefined} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <MaterialIcons name={locale === "he" ? "arrow-forward" : "arrow-back"} size={20} color={colors.orange} />
          <Text style={styles.backText}>{t("מחלקות")}</Text>
        </Pressable>
        <Text style={styles.title}>{department?.name ?? t("מחלקה")}</Text>
        <Text style={styles.subtitle}>{members.length} {t("עובדים במחלקה")}</Text>
        {loading ? <ActivityIndicator color={colors.orange} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {canAssign ? (
          <Pressable onPress={() => setPicker(true)} style={styles.assign}>
            <MaterialIcons name="person-add" size={20} color="#ffffff" />
            <Text style={styles.assignText}>{t("שייך עובד")}</Text>
          </Pressable>
        ) : null}

        {members.map((person) => (
          <View key={person.id} style={styles.row}>
            <View style={styles.personText}>
              <Text style={styles.personName}>{person.fullName}</Text>
              <Text style={styles.personMeta}>{person.jobTitle || t(roleLabel[person.role]) || person.role}</Text>
            </View>
          </View>
        ))}
        {!loading && members.length === 0 ? <Text style={styles.empty}>{t("אין עובדים משויכים למחלקה הזו")}</Text> : null}
      </ScrollView>

      <Modal visible={picker} animationType="slide" onRequestClose={() => setPicker(false)}>
        <View style={[styles.picker, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.pickerHead}>
            <Text style={styles.title}>{t("שייך עובד")}</Text>
            <Pressable onPress={() => setPicker(false)}>
              <Text style={styles.backText}>{t("סגור")}</Text>
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("חיפוש לפי שם")}
            placeholderTextColor={colors.muted}
            style={styles.search}
           
          />
          <ScrollView>
            {others.map((person) => (
              <Pressable key={person.id} onPress={() => assign(person)} disabled={busyId === person.id} style={styles.row}>
                <View style={styles.personText}>
                  <Text style={styles.personName}>{person.fullName}</Text>
                  <Text style={styles.personMeta}>
                    {deptName(person.departmentId)
                      ? tr(`משויך ל${deptName(person.departmentId)}`, `Assigned to ${deptName(person.departmentId)}`)
                      : t("ללא מחלקה")}
                  </Text>
                </View>
                {busyId === person.id ? <ActivityIndicator color={colors.orange} /> : <MaterialIcons name="add" size={22} color={colors.orange} />}
              </Pressable>
            ))}
            {others.length === 0 ? <Text style={styles.empty}>{t("אין עובדים נוספים לשיוך")}</Text> : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 16, },
  back: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  backText: { color: colors.orange, fontWeight: "800", },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", marginTop: 8 },
  subtitle: { color: colors.muted, marginBottom: 12 },
  loader: { marginVertical: 16 },
  error: { color: colors.danger, marginBottom: 12 },
  assign: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.orange,
    borderRadius: 14,
    minHeight: 48,
    marginBottom: 14,
  },
  assignText: { color: "#ffffff", fontWeight: "800", fontSize: 16, },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    padding: 12,
    marginBottom: 8,
  },
  personText: { flex: 1, alignItems: "flex-end" },
  personName: { color: colors.ink, fontSize: 16, fontWeight: "800", },
  personMeta: { color: colors.muted, marginTop: 2, },
  empty: { color: colors.muted, marginTop: 8 },
  picker: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, },
  pickerHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  search: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    marginVertical: 12,
    backgroundColor: "#ffffff",
    color: colors.ink,
  },
});
