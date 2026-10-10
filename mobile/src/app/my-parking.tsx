import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, ApiError } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";
import { t, tr } from "@/locale/i18n";

type DaySpot = {
  spotId: string;
  label: string;
  locationId: string;
  locationName: string;
  ownerId?: string;
  ownerName?: string;
  ownerInOffice: boolean;
  state: "free" | "owner_reserved" | "taken";
  reservation?: {
    id: string;
    employeeId: string;
    employeeName: string;
    selfClaimed: boolean;
    auto: boolean;
  };
};

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

function stateLabel(spot: DaySpot, userId: string): string {
  if (spot.state === "taken") {
    return spot.reservation?.employeeId === userId
      ? t("תפוסה על ידך")
      : tr(
          `תפוסה על ידי ${spot.reservation?.employeeName || "עובד/ת אחר/ת"}`,
          `Taken by ${spot.reservation?.employeeName || "someone else"}`
        );
  }
  if (spot.state === "owner_reserved") {
    return tr(
      `שמורה ל${spot.ownerName || "בעלים"} (במשרד)`,
      `Reserved for ${spot.ownerName || "the owner"} (in the office)`
    );
  }
  if (spot.ownerId) {
    return tr(
      `פנויה · ${spot.ownerName || "הבעלים"} לא במשרד`,
      `Free · ${spot.ownerName || "the owner"} is not in the office`
    );
  }
  return t("פנויה");
}

export default function MyParkingScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const today = useMemo(() => israelToday(), []);
  const tomorrow = addDays(today, 1);
  const choices = useMemo(() => Array.from({ length: 21 }, (_, index) => addDays(today, index)), [today]);
  const [date, setDate] = useState(today);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [spots, setSpots] = useState<DaySpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ items: DaySpot[] }>(`/api/parking/day?date=${date}`);
      setSpots(data.items);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "signedOut") return <Redirect href="/login" />;
  if (!user) return null;
  if (!canOpen(user.role, "myParking")) return <Redirect href="/home" />;

  const mine = spots.find((spot) => spot.reservation?.employeeId === user.id);
  const myFixed = spots.find((spot) => spot.ownerId === user.id);
  const freeCount = spots.filter((spot) => spot.state === "free").length;
  const groups = new Map<string, { name: string; items: DaySpot[] }>();
  for (const spot of spots) {
    const group = groups.get(spot.locationId) ?? { name: spot.locationName, items: [] };
    group.items.push(spot);
    groups.set(spot.locationId, group);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === user.locationId ? -1 : b === user.locationId ? 1 : 0
  );

  async function claim(spotId: string) {
    setBusy(true);
    setNotice(null);
    try {
      await api("/api/parking/claim", { method: "POST", body: { spotId, workDate: date } });
      setNotice(t("סימנת שתפסת את החנייה — כולם רואים שהיא תפוסה."));
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function release(reservationId: string) {
    Alert.alert(t("שחרור חנייה"), t("לשחרר את החנייה? היא תחזור להיות פנויה לכולם."), [
      { text: t("ביטול"), style: "cancel" },
      {
        text: t("שחרר"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setBusy(true);
            setNotice(null);
            try {
              await api(`/api/parking/reservations/${reservationId}`, { method: "DELETE" });
              setNotice(t("החנייה שוחררה."));
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
      <BrandHeader greeting={t("תפיסת חנייה")} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <HomeLink />
        <Text style={styles.subtitle}>
          {t("חנייה של מנהל שמורה לו רק בימים שהוא משובץ במשרד. בשאר הימים היא פנויה — מי שחונה בה מסמן «תפסתי חנייה».")}
          </Text>

        <View style={styles.filters}>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.dateButton}>
            <MaterialIcons name="calendar-today" size={18} color={colors.orange} />
            <Text style={styles.dateButtonText}>{displayDate(date)}</Text>
          </Pressable>
          <Pressable
            onPress={() => setDate(today)}
            style={[styles.chip, date === today && styles.chipOn]}
          >
            <Text style={[styles.chipText, date === today && styles.chipTextOn]}>{t("היום")}</Text>
          </Pressable>
          <Pressable
            onPress={() => setDate(tomorrow)}
            style={[styles.chip, date === tomorrow && styles.chipOn]}
          >
            <Text style={[styles.chipText, date === tomorrow && styles.chipTextOn]}>{t("מחר")}</Text>
          </Pressable>
        </View>
        {!loading && spots.length > 0 ? (
          <Text style={styles.summary}>
            {tr(
              `${weekday(date)} ${displayDate(date)} · ${freeCount} פנויות מתוך ${spots.length}`,
              `${weekday(date)} ${displayDate(date)} · ${freeCount} free of ${spots.length}`
            )}
          </Text>
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {mine?.reservation ? (
          <View style={styles.holdBanner}>
            <Text style={styles.holdText}>
              {tr(
                `תפסת את ${mine.label}${mine.locationName ? ` · ${mine.locationName}` : ""} בתאריך ${displayDate(date)}.`,
                `You took ${mine.label}${mine.locationName ? ` · ${mine.locationName}` : ""} on ${displayDate(date)}.`
              )}
            </Text>
            <Pressable disabled={busy} onPress={() => release(mine.reservation!.id)} style={styles.releaseLink}>
              <Text style={styles.releaseLinkText}>{t("שחרר חנייה")}</Text>
            </Pressable>
          </View>
        ) : null}

        {myFixed ? (
          <View style={styles.fixedBanner}>
            <Text style={styles.fixedTitle}>
              {tr(
                `החנייה הקבועה שלך: ${myFixed.label}${myFixed.locationName ? ` · ${myFixed.locationName}` : ""}`,
                `Your assigned spot: ${myFixed.label}${myFixed.locationName ? ` · ${myFixed.locationName}` : ""}`
              )}
            </Text>
            {!myFixed.ownerInOffice ? (
              <Text style={styles.fixedBody}>
                {myFixed.reservation
                  ? tr(
                      `לא משובץ/ת במשרד בתאריך זה — ${myFixed.reservation.employeeName} תפס/ה את החנייה שלך.`,
                      `You are not scheduled in the office on this date — ${myFixed.reservation.employeeName} took your spot.`
                    )
                  : t("לא משובץ/ת במשרד בתאריך זה — החנייה שלך פנויה לעובדים אחרים.")}
              </Text>
            ) : null}
          </View>
        ) : null}

        {loading ? (
          <ActivityIndicator color={colors.orange} style={{ marginTop: 24 }} />
        ) : spots.length === 0 ? (
          <Text style={styles.empty}>{t("לא הוגדרו חניות במערכת.")}</Text>
        ) : (
          ordered.map(([id, group]) => (
            <View key={id} style={styles.group}>
              {ordered.length > 1 ? <Text style={styles.groupTitle}>{group.name}</Text> : null}
              {group.items.map((spot) => {
                const isMine = spot.reservation?.employeeId === user.id;
                const free = spot.state === "free";
                const canClaim = free && !mine && spot.ownerId !== user.id;
                return (
                  <View
                    key={spot.spotId}
                    style={[
                      styles.card,
                      free && styles.cardFree,
                      isMine && styles.cardMine,
                    ]}
                  >
                    <View style={styles.cardHead}>
                      <MaterialIcons name="local-parking" size={22} color={free ? "#16a34a" : colors.muted} />
                      <Text style={styles.spotLabel}>{spot.label}</Text>
                    </View>
                    <View style={[styles.stateChip, free && styles.stateFree, isMine && styles.stateMine]}>
                      <Text style={[styles.stateText, free && styles.stateTextFree, isMine && styles.stateTextMine]}>
                        {stateLabel(spot, user.id)}
                      </Text>
                    </View>
                    {canClaim ? (
                      <Pressable
                        disabled={busy}
                        onPress={() => void claim(spot.spotId)}
                        style={({ pressed }) => [styles.claimButton, pressed && styles.claimPressed, busy && styles.disabled]}
                      >
                        <Text style={styles.claimText}>{t("תפסתי חנייה")}</Text>
                      </Pressable>
                    ) : null}
                    {isMine && spot.reservation ? (
                      <Pressable
                        disabled={busy}
                        onPress={() => release(spot.reservation!.id)}
                        style={styles.releaseButton}
                      >
                        <Text style={styles.releaseButtonText}>{t("שחרר חנייה")}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} onPress={() => undefined}>
            <Text style={styles.sheetTitle}>{t("תאריך")}</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {choices.map((iso) => (
                <Pressable
                  key={iso}
                  onPress={() => {
                    setDate(iso);
                    setPickerOpen(false);
                  }}
                  style={[styles.choice, iso === date && styles.choiceOn]}
                >
                  <Text style={styles.choiceText}>
                    {weekday(iso)} · {displayDate(iso)}
                  </Text>
                </Pressable>
              ))}
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
  subtitle: { color: colors.muted, lineHeight: 22, marginBottom: 14 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  dateButtonText: { color: colors.ink, fontWeight: "700", writingDirection: "ltr" },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.45)",
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  chipOn: { backgroundColor: colors.orange, borderColor: colors.orange },
  chipText: { color: colors.ink, fontWeight: "700", },
  chipTextOn: { color: "#ffffff" },
  summary: { color: colors.muted, marginBottom: 12 },
  notice: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  error: {
    backgroundColor: colors.dangerBg,
    color: colors.danger,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  holdBanner: { backgroundColor: "#dcfce7", borderRadius: 14, padding: 12, marginBottom: 10 },
  holdText: { color: "#166534", fontWeight: "700", },
  releaseLink: { alignSelf: "flex-start", marginTop: 8 },
  releaseLinkText: { color: "#166534", fontWeight: "800", },
  fixedBanner: { backgroundColor: "#e0f2fe", borderRadius: 14, padding: 12, marginBottom: 10 },
  fixedTitle: { color: "#0c4a6e", fontWeight: "800", },
  fixedBody: { color: "#0c4a6e", marginTop: 4 },
  empty: { color: colors.muted, marginTop: 16 },
  group: { marginBottom: 8 },
  groupTitle: { color: colors.ink, fontWeight: "800", marginBottom: 8, marginTop: 8 },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    marginBottom: 10,
  },
  cardFree: { borderWidth: 2, borderColor: "#22c55e" },
  cardMine: { borderWidth: 2, borderColor: colors.orange },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  spotLabel: { color: colors.ink, fontSize: 22, fontWeight: "800", },
  stateChip: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  stateFree: { backgroundColor: "#dcfce7" },
  stateMine: { backgroundColor: "rgba(249,115,22,0.16)" },
  stateText: { color: colors.muted, fontWeight: "700", },
  stateTextFree: { color: "#166534" },
  stateTextMine: { color: colors.orangePressed },
  claimButton: {
    backgroundColor: "#22c55e",
    borderRadius: 12,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  claimPressed: { backgroundColor: "#16a34a" },
  claimText: { color: "#ffffff", fontWeight: "800", },
  releaseButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  releaseButtonText: { color: colors.ink, fontWeight: "800", },
  disabled: { opacity: 0.5 },
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#ffffff", borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, },
  sheetTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  choice: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  choiceOn: { backgroundColor: "rgba(249,115,22,0.12)" },
  choiceText: { color: colors.ink, fontWeight: "600" },
});
