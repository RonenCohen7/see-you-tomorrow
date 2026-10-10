import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Linking,
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
import { hello, t, tr } from "@/locale/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { api } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";

type Loc = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  address?: string;
  capacity: number;
  isActive: boolean;
};

type FormState = { id: string | null; name: string; address: string; city: string; country: string; capacity: string };

const EMPTY: FormState = { id: null, name: "", address: "", city: "", country: "", capacity: "50" };

type Geo = { lat: number; lon: number; label: string };

const geoCache = new Map<string, Geo | null>();

function placeQuery(loc: Pick<Loc, "address" | "city" | "country">): string {
  return [loc.address, loc.city, loc.country].map((part) => (part ?? "").trim()).filter(Boolean).join(", ");
}

async function geocode(query: string): Promise<Geo | null> {
  if (geoCache.has(query)) return geoCache.get(query) ?? null;
  const headers = { Accept: "application/json", "Accept-Language": "he", "User-Agent": "SeeYouTomorrow/1.0" };
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
    { headers }
  );
  const rows = response.ok ? ((await response.json()) as { lat: string; lon: string; display_name?: string }[]) : [];
  const hit = rows[0];
  const lat = Number(hit?.lat);
  const lon = Number(hit?.lon);
  const geo = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, label: hit?.display_name ?? query } : null;
  geoCache.set(query, geo);
  return geo;
}

function mapHtml(lat: number, lon: number): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>html,body,#map{height:100%;margin:0;background:#e7e5e4} .leaflet-control-attribution{font-size:10px}</style>
</head><body><div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map = L.map('map', { zoomControl: false, dragging: false, scrollWheelZoom: false }).setView([${lat}, ${lon}], 16);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
L.marker([${lat}, ${lon}]).addTo(map);
</script></body></html>`;
}

function LocationMap({ query }: { query: string }) {
  const [geo, setGeo] = useState<Geo | null>(geoCache.get(query) ?? null);
  const [phase, setPhase] = useState<"loading" | "ready" | "miss">(geo ? "ready" : "loading");

  useEffect(() => {
    let cancelled = false;
    const cached = geoCache.get(query);
    if (cached) {
      setGeo(cached);
      setPhase("ready");
      return;
    }
    if (geoCache.has(query)) {
      setGeo(null);
      setPhase("miss");
      return;
    }
    setPhase("loading");
    geocode(query)
      .then((found) => {
        if (cancelled) return;
        setGeo(found);
        setPhase(found ? "ready" : "miss");
      })
      .catch(() => {
        if (!cancelled) setPhase("miss");
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (phase === "loading") {
    return (
      <View style={styles.mapFrame}>
        <ActivityIndicator color={colors.orange} style={styles.mapSpinner} />
      </View>
    );
  }
  if (!geo) {
    return <Text style={styles.noMap}>{t("לא נמצאה נקודה במפה לכתובת הזו. בדקו רחוב, מספר בית ועיר.")}</Text>;
  }
  return (
    <View>
      <View style={styles.mapFrame}>
        <WebView
          source={{ html: mapHtml(geo.lat, geo.lon), baseUrl: "https://tile.openstreetmap.org" }}
          style={styles.map}
          scrollEnabled={false}
          originWhitelist={["*"]}
          pointerEvents="none"
        />
      </View>
      <Text style={styles.geoLabel} numberOfLines={2}>
        {geo.label}
      </Text>
      <Pressable
        onPress={() =>
          void Linking.openURL(`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lon}#map=17/${geo.lat}/${geo.lon}`)
        }
      >
        <Text style={styles.link}>{t("פתיחה במפה")}</Text>
      </Pressable>
    </View>
  );
}

export default function LocationsScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const canWrite = user?.role === "admin";
  const [activeOnly, setActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Loc[]>([]);
  const [editor, setEditor] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const formScroll = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = activeOnly ? "?isActive=true" : "";
      const data = await api<{ items: Loc[] }>(`/api/locations${qs}`);
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("לא ניתן לטעון מיקומים"));
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

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

  async function save() {
    if (!editor || !editor.name.trim()) return;
    const capacity = Number(editor.capacity);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setError(t("קיבולת צריכה להיות מספר גדול מאפס"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: editor.name.trim(),
        address: editor.address.trim() || undefined,
        city: editor.city.trim() || undefined,
        country: editor.country.trim() || undefined,
        capacity,
      };
      if (editor.id) await api(`/api/locations/${editor.id}`, { method: "PUT", body: payload });
      else await api("/api/locations", { method: "POST", body: payload });
      setEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("שמירת המיקום נכשלה"));
    } finally {
      setSaving(false);
    }
  }

  function deactivate(loc: Loc) {
    Alert.alert(
      t("מיקום"),
      tr(
        `לסמן את המיקום «${loc.name}» כלא פעיל? הרשומה נשארת במערכת לצורך שיבוץ והיסטוריה.`,
        `Mark “${loc.name}” inactive? The record stays for scheduling and history.`
      ),
      [
        { text: t("ביטול"), style: "cancel" },
        {
          text: t("סימון כלא פעיל"),
          style: "destructive",
          onPress: () => {
            void api(`/api/locations/${loc.id}`, { method: "DELETE" })
              .then(() => load())
              .catch((err: unknown) => setError(err instanceof Error ? err.message : t("הפעולה נכשלה")));
          },
        },
      ]
    );
  }

  async function activate(loc: Loc) {
    try {
      await api(`/api/locations/${loc.id}`, { method: "PUT", body: { isActive: true } });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("הפעלת המיקום נכשלה"));
    }
  }

  if (status === "signedOut") return <Redirect href="/login" />;
  if (user && !canOpen(user.role, "locations")) return <Redirect href="/home" />;

  const capacityOk = Number(editor?.capacity) > 0;

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={user ? hello(user.fullName) : undefined} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <View style={styles.titleRow}>
          <MaterialIcons name="place" size={26} color={colors.orange} />
          <Text style={styles.title}>{t("מיקומים")}</Text>
          <View style={styles.count}>
            <Text style={styles.countText}>{items.length} {t("סה״כ")}</Text>
          </View>
        </View>

        <Text style={styles.purpose}>
          {t("כאן מוגדרים הסניפים והמשרדים הפיזיים של הארגון — שם לתצוגה, כתובת, קיבולת והצגת מפה. המיקומים משמשים לשיוך עובדים ומחלקות, לחדרי ישיבות, לחוקי שיבוץ ולמשאבי משרד.")}
          </Text>
        <Text style={styles.purpose}>
          {t("חשוב לעדכן את הפרטים בכל פתיחת סניף, החלפת כתובת או שינוי בתכולת המקום.")}
          </Text>

        <View style={styles.tools}>
          <View style={styles.switchRow}>
            <Switch value={activeOnly} onValueChange={setActiveOnly} trackColor={{ true: colors.orange }} />
            <Text style={styles.switchLabel}>{t("פעילים בלבד")}</Text>
          </View>
          {canWrite ? (
            <Pressable onPress={() => setEditor(EMPTY)} style={styles.add}>
              <MaterialIcons name="add-circle" size={28} color="#ffffff" />
            </Pressable>
          ) : null}
        </View>

        {loading ? <ActivityIndicator color={colors.orange} style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && items.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons name="place" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>{activeOnly ? t("אין מיקומים פעילים להצגה") : t("אין מיקומים עדיין")}</Text>
            {activeOnly ? (
              <Pressable onPress={() => setActiveOnly(false)}>
                <Text style={styles.link}>{t("הצג את כל המיקומים")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          items.map((loc) => {
            const query = placeQuery(loc);
            const fill = loc.capacity > 0 ? Math.min(100, Math.round((loc.capacity / 200) * 100)) : 0;
            const place = [loc.city, loc.country].filter(Boolean).join(", ");
            return (
              <View key={loc.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.pin}>
                    <MaterialIcons name="place" size={26} color={colors.sky} />
                  </View>
                  <View style={styles.cardTitle}>
                    <Text style={styles.name}>{loc.name}</Text>
                    {place ? <Text style={styles.meta}>{place}</Text> : null}
                    {loc.address ? <Text style={styles.meta}>{loc.address}</Text> : null}
                  </View>
                  <View style={[styles.badge, loc.isActive ? styles.badgeOn : styles.badgeOff]}>
                    <Text style={[styles.badgeText, loc.isActive ? styles.badgeTextOn : styles.badgeTextOff]}>
                      {loc.isActive ? t("פעיל") : t("לא פעיל")}
                    </Text>
                  </View>
                </View>

                <View style={styles.capacityRow}>
                  <MaterialIcons name="people" size={18} color={colors.muted} />
                  <Text style={styles.meta}>{t("קיבולת:")}</Text>
                  <Text style={styles.capacity}>{loc.capacity}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${fill}%` }]} />
                </View>

                {canWrite && !loc.isActive ? (
                  <Pressable onPress={() => void activate(loc)} style={styles.activate}>
                    <Text style={styles.activateText}>{t("הפעל")}</Text>
                  </Pressable>
                ) : null}

                {query ? (
                  <View style={styles.mapBlock}>
                    <View style={styles.capacityRow}>
                      <MaterialIcons name="map" size={18} color={colors.muted} />
                      <Text style={styles.mapLabel}>{t("מפה לפי כתובת")}</Text>
                    </View>
                    <LocationMap query={query} />
                  </View>
                ) : (
                  <Text style={styles.noMap}>{t("הוסיפו כתובת בעריכה כדי להציג מפה")}</Text>
                )}

                {canWrite ? (
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() =>
                        setEditor({
                          id: loc.id,
                          name: loc.name,
                          address: loc.address ?? "",
                          city: loc.city ?? "",
                          country: loc.country ?? "",
                          capacity: String(loc.capacity),
                        })
                      }
                      hitSlop={8}
                    >
                      <MaterialIcons name="edit" size={22} color={colors.orange} />
                    </Pressable>
                    {loc.isActive ? (
                      <Pressable onPress={() => deactivate(loc)} hitSlop={8}>
                        <MaterialIcons name="delete-outline" size={22} color={colors.red} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!editor} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditor(null)}>
        <View style={[styles.formScreen, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.modalTitle}>{editor?.id ? t("עריכה") : t("מיקום חדש")}</Text>
          <ScrollView
            ref={formScroll}
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <View onLayout={(event) => { fieldY.current.name = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("שם")}</Text>
              <TextInput
                value={editor?.name ?? ""}
                onChangeText={(name) => setEditor((current) => (current ? { ...current, name } : current))}
                onFocus={() => reveal("name")}
                style={styles.input}
               
                returnKeyType="next"
              />
            </View>
            <View onLayout={(event) => { fieldY.current.address = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("כתובת (למפה)")}</Text>
              <TextInput
                value={editor?.address ?? ""}
                onChangeText={(address) => setEditor((current) => (current ? { ...current, address } : current))}
                onFocus={() => reveal("address")}
                style={[styles.input, styles.inputTall]}
               
                multiline
              />
              <Text style={styles.hint}>{t("רחוב ומספר בית, למשל הרצל 10")}</Text>
            </View>
            <View onLayout={(event) => { fieldY.current.city = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("עיר")}</Text>
              <TextInput
                value={editor?.city ?? ""}
                onChangeText={(city) => setEditor((current) => (current ? { ...current, city } : current))}
                onFocus={() => reveal("city")}
                style={styles.input}
               
                returnKeyType="next"
              />
            </View>
            <View onLayout={(event) => { fieldY.current.country = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("מדינה")}</Text>
              <TextInput
                value={editor?.country ?? ""}
                onChangeText={(country) => setEditor((current) => (current ? { ...current, country } : current))}
                onFocus={() => reveal("country")}
                style={styles.input}
                placeholder={t("למשל ישראל")}
                placeholderTextColor={colors.muted}
               
                returnKeyType="next"
              />
            </View>
            <View onLayout={(event) => { fieldY.current.capacity = event.nativeEvent.layout.y; }}>
              <Text style={styles.fieldLabel}>{t("קיבולת")}</Text>
              <TextInput
                value={editor?.capacity ?? ""}
                onChangeText={(capacity) => setEditor((current) => (current ? { ...current, capacity } : current))}
                onFocus={() => reveal("capacity")}
                style={styles.input}
                keyboardType="number-pad"
               
              />
            </View>
          </ScrollView>
          <View style={[styles.formFooter, { marginBottom: keyboardHeight, paddingBottom: keyboardHeight ? 10 : insets.bottom + 10 }]}>
            <Pressable onPress={() => setEditor(null)} style={styles.cancel}>
              <Text style={styles.cancelText}>{t("ביטול")}</Text>
            </Pressable>
            <Pressable
              onPress={() => void save()}
              disabled={saving || !editor?.name.trim() || !capacityOk}
              style={styles.save}
            >
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
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", },
  count: { backgroundColor: "rgba(15,23,42,0.06)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: colors.ink, fontWeight: "700", },
  purpose: { color: colors.muted, marginTop: 8, lineHeight: 20 },
  tools: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switchLabel: { color: colors.ink, },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  loader: { marginVertical: 24 },
  error: { color: colors.danger, marginBottom: 12 },
  empty: { alignItems: "center", padding: 24, gap: 8 },
  emptyTitle: { color: colors.muted, fontSize: 16, textAlign: "center" },
  link: { color: colors.orange, fontWeight: "800", marginTop: 8 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    marginBottom: 12,
    padding: 12,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  pin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(14,165,233,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { flex: 1, alignItems: "flex-end" },
  name: { color: colors.ink, fontSize: 18, fontWeight: "800", },
  meta: { color: colors.muted, },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeOn: { backgroundColor: "rgba(34,197,94,0.16)" },
  badgeOff: { backgroundColor: "rgba(15,23,42,0.06)" },
  badgeText: { fontWeight: "800", fontSize: 12, },
  badgeTextOn: { color: "#15803d" },
  badgeTextOff: { color: colors.muted },
  capacityRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  capacity: { color: colors.ink, fontWeight: "800" },
  track: { height: 6, borderRadius: 3, backgroundColor: "rgba(14,165,233,0.12)", marginTop: 6, overflow: "hidden" },
  fill: { height: 6, backgroundColor: colors.sky },
  activate: { marginTop: 10, backgroundColor: "#16a34a", borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  activateText: { color: "#ffffff", fontWeight: "800", },
  mapBlock: { marginTop: 8 },
  mapLabel: { color: colors.muted, fontWeight: "700", },
  mapFrame: { height: 168, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: "rgba(15,23,42,0.08)", marginTop: 6 },
  map: { flex: 1, backgroundColor: "#e7e5e4" },
  mapSpinner: { marginTop: 70 },
  geoLabel: { color: colors.muted, fontSize: 12, marginTop: 6 },
  noMap: { color: colors.muted, marginTop: 12, },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 16, marginTop: 8 },
  formScreen: { flex: 1, backgroundColor: "#ffffff", paddingHorizontal: 16, },
  formScroll: { flex: 1 },
  formContent: { paddingBottom: 24 },
  formFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(15,23,42,0.08)",
    backgroundColor: "#ffffff",
  },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  fieldLabel: { color: colors.muted, marginTop: 12, },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    marginTop: 6,
    color: colors.ink,
  },
  inputTall: { minHeight: 72, textAlignVertical: "top", paddingTop: 10 },
  cancel: { paddingHorizontal: 12, paddingVertical: 10 },
  cancelText: { color: colors.muted, fontWeight: "700", },
  save: { backgroundColor: colors.orange, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  saveText: { color: "#ffffff", fontWeight: "800", },
});
