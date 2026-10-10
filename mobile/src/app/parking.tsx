import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { t, tr } from "@/locale/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors, roleLabel } from "@/ui/theme";

type Spot = {
  id: string;
  locationId: string;
  locationName: string;
  label: string;
  assignedEmployeeId?: string;
  isActive: boolean;
};

type Reservation = {
  id: string;
  spotId: string;
  employeeId: string;
  guestFullName?: string;
  workDate: string;
  hourStart?: number;
  hourEnd?: number;
};

type Person = { id: string; fullName: string; role?: string; isActive?: boolean };
type Place = { id: string; name: string };

const WEEKDAY = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת"];

function israelToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekday(iso: string): string {
  return t(WEEKDAY[new Date(`${iso}T12:00:00Z`).getUTCDay()] ?? "");
}

function displayDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : t("שגיאה");
}

function hoursLabel(row: Reservation): string {
  if (row.hourStart == null && row.hourEnd == null) return t("יום מלא");
  return `${row.hourStart ?? "—"}–${row.hourEnd ?? "—"}`;
}

export default function ParkingManagementScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const today = useMemo(() => israelToday(), []);
  const rangeTo = useMemo(() => addDays(today, 21), [today]);
  const dateChoices = useMemo(() => Array.from({ length: 22 }, (_, index) => addDays(today, index)), [today]);
  const role = user?.role?.trim().toLowerCase();
  const isAdmin = role === "admin";
  const canAssignPermanent = role === "admin" || role === "manager";

  const [spots, setSpots] = useState<Spot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [seedLoc, setSeedLoc] = useState("");
  const [picker, setPicker] = useState<
    null | "seed" | "addLoc" | "assign" | "remove" | "resSpot" | "resPerson" | "resDate"
  >(null);
  const [assignSpotId, setAssignSpotId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addLoc, setAddLoc] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [resOpen, setResOpen] = useState(false);
  const [resSpot, setResSpot] = useState("");
  const [resPerson, setResPerson] = useState("");
  const [resDate, setResDate] = useState(today);
  const [hourStart, setHourStart] = useState("");
  const [hourEnd, setHourEnd] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const formScroll = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [spotData, resData] = await Promise.all([
        api<{ items: Spot[] }>("/api/parking/spots"),
        api<{ items: Reservation[] }>(`/api/parking/reservations?from=${today}&to=${rangeTo}`),
      ]);
      setSpots(spotData.items);
      setReservations(resData.items);
      const collected: Person[] = [];
      let page = 1;
      while (page < 20) {
        const data = await api<{ items: Person[]; total: number }>(
          `/api/employees?scope=company&page=${page}&limit=100`
        );
        collected.push(...data.items);
        if (collected.length >= data.total || data.items.length === 0) break;
        page += 1;
      }
      setPeople(collected.filter((person) => person.isActive !== false));
      if (isAdmin) {
        const locData = await api<{ items: Place[] }>("/api/locations?isActive=true");
        setPlaces(locData.items);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [today, rangeTo, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (status === "signedOut") return <Redirect href="/login" />;
  if (!user) return null;
  if (!canOpen(user.role, "parking")) return <Redirect href="/home" />;

  const names = new Map(people.map((person) => [person.id, person.fullName]));
  const spotById = new Map(spots.map((spot) => [spot.id, spot]));

  function holderName(spot: Spot): string | null {
    if (!spot.assignedEmployeeId) return null;
    return names.get(spot.assignedEmployeeId) ?? "—";
  }

  async function seed() {
    if (!seedLoc) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/parking/spots/seed-ten", { method: "POST", body: { locationId: seedLoc } });
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function assign(spotId: string, employeeId: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/parking/spots/${spotId}`, {
        method: "PATCH",
        body: { assignedEmployeeId: employeeId || null },
      });
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function createSpot() {
    if (!addLoc) return;
    setBusy(true);
    setError(null);
    try {
      const label = addLabel.trim();
      await api("/api/parking/spots", {
        method: "POST",
        body: label ? { locationId: addLoc, label } : { locationId: addLoc },
      });
      setAddOpen(false);
      setAddLabel("");
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function removeSpot(spotId: string) {
    const spot = spotById.get(spotId);
    Alert.alert(
      t("הסרת חנייה"),
      tr(
        `למחוק את ${spot?.label ?? "החנייה"}? כל ההקצאות הזמניות שלה יימחקו.`,
        `Delete ${spot?.label ?? "this spot"}? Its temporary assignments will be deleted too.`
      ),
      [
      { text: t("ביטול"), style: "cancel" },
      {
        text: t("מחיקה"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await api(`/api/parking/spots/${spotId}`, { method: "DELETE" });
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

  function removeReservation(id: string) {
    Alert.alert(t("מחיקת הקצאה"), t("למחוק הקצאה זו?"), [
      { text: t("ביטול"), style: "cancel" },
      {
        text: t("מחיקה"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            try {
              await api(`/api/parking/reservations/${id}`, { method: "DELETE" });
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

  async function saveReservation() {
    const start = hourStart.trim() === "" ? undefined : Number(hourStart);
    const end = hourEnd.trim() === "" ? undefined : Number(hourEnd);
    if ((start !== undefined && !Number.isFinite(start)) || (end !== undefined && !Number.isFinite(end))) {
      setError(t("שעה לא תקינה"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/parking/reservations", {
        method: "POST",
        body: {
          spotId: resSpot,
          employeeId: resPerson,
          workDate: resDate,
          ...(start !== undefined ? { hourStart: start } : {}),
          ...(end !== undefined ? { hourEnd: end } : {}),
        },
      });
      setResOpen(false);
      setResSpot("");
      setResPerson("");
      setHourStart("");
      setHourEnd("");
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  const pickerTitle =
    picker === "seed" || picker === "addLoc"
      ? t("מיקום")
      : picker === "remove"
        ? t("בחרו חנייה להסרה")
        : picker === "resSpot"
          ? t("חניה")
          : picker === "resPerson"
            ? t("משתמש/ת בחניה")
            : picker === "resDate"
              ? t("תאריך")
              : t("שיוך קבוע");

  const pickerOptions: { id: string; label: string }[] =
    picker === "seed" || picker === "addLoc"
      ? places.map((place) => ({ id: place.id, label: place.name }))
      : picker === "remove"
        ? spots.map((spot) => ({ id: spot.id, label: `${spot.label} · ${spot.locationName}` }))
        : picker === "resSpot"
          ? spots.filter((spot) => spot.isActive).map((spot) => ({ id: spot.id, label: `${spot.label} · ${spot.locationName}` }))
          : picker === "resPerson"
            ? people.map((person) => ({ id: person.id, label: person.fullName }))
            : picker === "resDate"
              ? dateChoices.map((iso) => ({ id: iso, label: `${weekday(iso)} · ${displayDate(iso)}` }))
              : [{ id: "", label: t("— ללא שיוך") }, ...people.map((person) => ({
                  id: person.id,
                  label:
                    person.role === "manager" || person.role === "admin"
                      ? `${person.fullName} · ${t(roleLabel[person.role]) ?? person.role}`
                      : person.fullName,
                }))];

  function onPick(id: string) {
    if (picker === "seed") setSeedLoc(id);
    if (picker === "addLoc") setAddLoc(id);
    if (picker === "assign") void assign(assignSpotId, id);
    if (picker === "remove") removeSpot(id);
    if (picker === "resSpot") setResSpot(id);
    if (picker === "resPerson") setResPerson(id);
    if (picker === "resDate") setResDate(id);
    setPicker(null);
  }

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={t("ניהול חניות")} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>{t("חניות")}</Text>
          <Pressable onPress={() => void load()} hitSlop={8}>
            <MaterialIcons name="refresh" size={22} color={colors.orange} />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {t("חניה קבועה למנהל. כשהוא לא משובץ למשרד, החניה פנויה להקצאה זמנית לפי יום ושעות.")}
          </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={colors.orange} style={{ marginTop: 24 }} /> : null}

        {isAdmin ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t("יצירת עד 10 חניות במיקום")}</Text>
            <Pressable onPress={() => setPicker("seed")} style={styles.field}>
              <Text style={styles.fieldText}>{places.find((place) => place.id === seedLoc)?.name || t("מיקום")}</Text>
              <MaterialIcons name="arrow-drop-down" size={22} color={colors.muted} />
            </Pressable>
            <Pressable
              disabled={!seedLoc || busy}
              onPress={() => void seed()}
              style={({ pressed }) => [styles.primary, (!seedLoc || busy) && styles.disabled, pressed && styles.primaryPressed]}
            >
              <Text style={styles.primaryText}>{t("השלם ל-10 חניות")}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.panel}>
          <View style={styles.titleRow}>
            <Text style={styles.panelTitle}>{t("הקצאות זמניות")}</Text>
            <Pressable
              onPress={() => {
                setResDate(today);
                setResOpen(true);
              }}
              style={styles.smallPrimary}
            >
              <Text style={styles.smallPrimaryText}>{t("הקצאת חניה")}</Text>
            </Pressable>
          </View>
          {reservations.length === 0 ? <Text style={styles.empty}>{t("אין הקצאות ב־21 הימים הקרובים.")}</Text> : null}
          {reservations.map((row) => {
            const spot = spotById.get(row.spotId);
            const guest = row.guestFullName || names.get(row.employeeId) || "—";
            return (
              <View key={row.id} style={styles.resRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resTitle}>
                    {displayDate(row.workDate)} · {spot?.label ?? t("חניה")}
                  </Text>
                  <Text style={styles.resMeta}>
                    {guest} · {hoursLabel(row)}
                  </Text>
                </View>
                <Pressable disabled={busy} onPress={() => removeReservation(row.id)} hitSlop={8}>
                  <Text style={styles.deleteText}>{t("מחיקה")}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <View style={styles.panel}>
          <View style={styles.titleRow}>
            <Text style={styles.panelTitle}>{t("רשימת חניות")}</Text>
          </View>
          {isAdmin ? (
            <View style={styles.adminActions}>
              <Pressable
                onPress={() => {
                  setAddLoc(seedLoc || places[0]?.id || "");
                  setAddLabel("");
                  setAddOpen(true);
                }}
                style={styles.smallPrimary}
              >
                <Text style={styles.smallPrimaryText}>{t("הוספת חנייה")}</Text>
              </Pressable>
              <Pressable onPress={() => setPicker("remove")} style={styles.dangerOutline}>
                <Text style={styles.dangerOutlineText}>{t("הסרת חנייה")}</Text>
              </Pressable>
            </View>
          ) : null}
          {canAssignPermanent ? (
            <Text style={styles.hint}>
              {t("בשדה «שיוך קבוע» קובעים את בעל החנייה. כשהוא במשרד החנייה שמורה לו; כשאינו במשרד היא נפתחת לתפיסה.")}
              </Text>
          ) : null}
          {spots.map((spot) => {
            const occupied = Boolean(spot.assignedEmployeeId);
            return (
              <View key={spot.id} style={[styles.spot, occupied ? styles.spotTaken : styles.spotFree, !spot.isActive && styles.inactive]}>
                <Text style={styles.spotCaption}>{t("חניה")}</Text>
                <Text style={styles.spotLabel}>{spot.label}</Text>
                <Text style={styles.spotPlace}>{spot.locationName}</Text>
                {occupied ? (
                  <>
                    <Text style={styles.ownerCaption}>{t("בעלים קבוע")}</Text>
                    <Text style={styles.ownerName}>{holderName(spot)}</Text>
                  </>
                ) : (
                  <Text style={styles.vacant}>{t("פנויה")}</Text>
                )}
                {canAssignPermanent ? (
                  <Pressable
                    onPress={() => {
                      setAssignSpotId(spot.id);
                      setPicker("assign");
                    }}
                    style={styles.field}
                  >
                    <Text style={styles.fieldText} numberOfLines={1}>
                      {tr("שיוך קבוע:", "Permanent assignment:")} {holderName(spot) || "—"}
                    </Text>
                    <MaterialIcons name="arrow-drop-down" size={22} color={colors.muted} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal
        visible={picker === "seed" || picker === "assign" || picker === "remove"}
        animationType="slide"
        transparent
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{pickerTitle}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {pickerOptions.map((option) => (
                <Pressable key={option.id || "none"} onPress={() => onPick(option.id)} style={styles.choice}>
                  <Text style={styles.choiceText}>{t(option.label)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={addOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setAddOpen(false)}>
        <View style={[styles.formScreen, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.formTitle}>{picker === "addLoc" ? t("מיקום") : t("חנייה חדשה")}</Text>
          {picker === "addLoc" ? (
            <ScrollView style={{ flex: 1 }}>
              {places.map((place) => (
                <Pressable key={place.id} onPress={() => onPick(place.id)} style={styles.choice}>
                  <Text style={styles.choiceText}>{place.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
          <ScrollView
            ref={formScroll}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: keyboardHeight + 24 }}
          >
            <Text style={styles.label}>{t("מיקום")}</Text>
            <Pressable onPress={() => setPicker("addLoc")} style={styles.field}>
              <Text style={styles.fieldText}>{places.find((place) => place.id === addLoc)?.name || t("בחרו מיקום")}</Text>
            </Pressable>
            <Text style={styles.label}>{t("שם חנייה (אופציונלי)")}</Text>
            <TextInput
              value={addLabel}
              onChangeText={setAddLabel}
              onFocus={() => formScroll.current?.scrollTo({ y: fieldY.current.label ?? 0, animated: true })}
              onLayout={(event) => {
                fieldY.current.label = event.nativeEvent.layout.y;
              }}
              style={styles.input}
             
            />
          </ScrollView>
          )}
          <View style={[styles.formFooter, { marginBottom: keyboardHeight, paddingBottom: keyboardHeight ? 10 : insets.bottom + 10 }]}>
            <Pressable
              onPress={() => (picker === "addLoc" ? setPicker(null) : setAddOpen(false))}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>{t("ביטול")}</Text>
            </Pressable>
            {picker === "addLoc" ? null : (
            <Pressable
              disabled={!addLoc || busy}
              onPress={() => void createSpot()}
              style={[styles.footerSave, (!addLoc || busy) && styles.disabled]}
            >
              <Text style={styles.primaryText}>{t("שמירה")}</Text>
            </Pressable>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={resOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setResOpen(false)}>
        <View style={[styles.formScreen, { paddingTop: insets.top + 12 }]}>
          <Text style={styles.formTitle}>{pickerTitle && (picker === "resSpot" || picker === "resPerson" || picker === "resDate") ? pickerTitle : t("הקצאת חניה")}</Text>
          {picker === "resSpot" || picker === "resPerson" || picker === "resDate" ? (
            <ScrollView style={{ flex: 1 }}>
              {pickerOptions.map((option) => (
                <Pressable key={option.id} onPress={() => onPick(option.id)} style={styles.choice}>
                  <Text style={styles.choiceText}>{t(option.label)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: keyboardHeight + 24 }}>
            <Text style={styles.label}>{t("חניה")}</Text>
            <Pressable onPress={() => setPicker("resSpot")} style={styles.field}>
              <Text style={styles.fieldText}>
                {spotById.get(resSpot) ? `${spotById.get(resSpot)?.label} · ${spotById.get(resSpot)?.locationName}` : t("בחרו חניה")}
              </Text>
            </Pressable>
            <Text style={styles.label}>{t("משתמש/ת בחניה")}</Text>
            <Pressable onPress={() => setPicker("resPerson")} style={styles.field}>
              <Text style={styles.fieldText}>{names.get(resPerson) || t("בחרו עובד")}</Text>
            </Pressable>
            <Text style={styles.label}>{t("תאריך")}</Text>
            <Pressable onPress={() => setPicker("resDate")} style={styles.field}>
              <Text style={styles.fieldText}>
                {weekday(resDate)} · {displayDate(resDate)}
              </Text>
            </Pressable>
            <Text style={styles.label}>{t("משעה (אופציונלי)")}</Text>
            <TextInput
              value={hourStart}
              onChangeText={setHourStart}
              keyboardType="decimal-pad"
              placeholder={t("ריק = יום מלא")}
              placeholderTextColor={colors.muted}
              style={styles.input}
             
            />
            <Text style={styles.label}>{t("עד שעה (אופציונלי)")}</Text>
            <TextInput
              value={hourEnd}
              onChangeText={setHourEnd}
              keyboardType="decimal-pad"
              style={styles.input}
             
            />
          </ScrollView>
          )}
          <View style={[styles.formFooter, { marginBottom: keyboardHeight, paddingBottom: keyboardHeight ? 10 : insets.bottom + 10 }]}>
            <Pressable
              onPress={() =>
                picker === "resSpot" || picker === "resPerson" || picker === "resDate" ? setPicker(null) : setResOpen(false)
              }
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>{t("ביטול")}</Text>
            </Pressable>
            {picker === "resSpot" || picker === "resPerson" || picker === "resDate" ? null : (
            <Pressable
              disabled={!resSpot || !resPerson || busy}
              onPress={() => void saveReservation()}
              style={[styles.footerSave, (!resSpot || !resPerson || busy) && styles.disabled]}
            >
              <Text style={styles.primaryText}>{t("שמירה")}</Text>
            </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 12, },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  pageTitle: { color: colors.ink, fontSize: 26, fontWeight: "800", },
  subtitle: { color: colors.muted, lineHeight: 22, marginBottom: 12 },
  error: {
    backgroundColor: colors.dangerBg,
    color: colors.danger,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 12,
  },
  panelTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", },
  field: {
    marginTop: 10,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  fieldText: { color: colors.ink, fontWeight: "600", flex: 1 },
  footerSave: {
    flex: 1,
    backgroundColor: colors.orange,
    borderRadius: 12,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primary: {
    marginTop: 12,
    backgroundColor: colors.orange,
    borderRadius: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  primaryPressed: { backgroundColor: colors.orangePressed },
  primaryText: { color: "#ffffff", fontWeight: "800", },
  smallPrimary: {
    backgroundColor: colors.orange,
    borderRadius: 10,
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  smallPrimaryText: { color: "#ffffff", fontWeight: "800", },
  adminActions: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 8 },
  dangerOutline: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: 10,
    minHeight: 36,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dangerOutlineText: { color: colors.danger, fontWeight: "800", },
  hint: { color: colors.muted, lineHeight: 20, marginBottom: 10 },
  empty: { color: colors.muted, marginTop: 8 },
  resRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: 10,
  },
  resTitle: { color: colors.ink, fontWeight: "700", },
  resMeta: { color: colors.muted, marginTop: 2 },
  deleteText: { color: colors.danger, fontWeight: "800", },
  spot: { borderWidth: 2, borderRadius: 16, padding: 12, marginBottom: 10 },
  spotFree: { borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.12)" },
  spotTaken: { borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.1)" },
  inactive: { opacity: 0.5 },
  spotCaption: { color: colors.muted, fontWeight: "700" },
  spotLabel: { color: colors.ink, fontSize: 28, fontWeight: "800", },
  spotPlace: { color: colors.muted, },
  ownerCaption: { color: colors.muted, marginTop: 8, fontWeight: "700" },
  ownerName: { color: colors.danger, fontWeight: "800", fontSize: 16 },
  vacant: { color: "#166534", fontWeight: "800", marginTop: 8 },
  disabled: { opacity: 0.45 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  choice: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  choiceText: { color: colors.ink, fontWeight: "600" },
  formScreen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 16, },
  formTitle: { color: colors.ink, fontSize: 22, fontWeight: "800", marginBottom: 12 },
  label: { color: colors.muted, marginTop: 12, marginBottom: 4 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    color: colors.ink,
  },
  formFooter: { flexDirection: "row", gap: 10, alignItems: "center" },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  cancelText: { color: colors.ink, fontWeight: "800", },
});
