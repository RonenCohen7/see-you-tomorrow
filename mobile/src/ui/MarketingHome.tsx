import MaskedView from "@react-native-masked-view/masked-view";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "./BrandHeader";
import { colors } from "./theme";

const logo = require("../../assets/logo.png");

const faces = [
  { name: "Noa", photo: "https://i.pravatar.cc/160?img=5", accent: "#f97316" },
  { name: "David", photo: "https://i.pravatar.cc/160?img=12", accent: "#0ea5e9" },
  { name: "Maya", photo: "https://i.pravatar.cc/160?img=9", accent: "#22c55e" },
  { name: "Yosef", photo: "https://i.pravatar.cc/160?img=15", accent: "#a78bfa" },
  { name: "Shira", photo: "https://i.pravatar.cc/160?img=20", accent: "#ec4899" },
  { name: "Amit", photo: "https://i.pravatar.cc/160?img=33", accent: "#14b8a6" },
  { name: "Leah", photo: "https://i.pravatar.cc/160?img=25", accent: "#f59e0b" },
  { name: "Omer", photo: "https://i.pravatar.cc/160?img=51", accent: "#6366f1" },
];

const dayTones = ["off", "home", "office", "off", "vacation", "office", "off"] as const;

function toneColor(tone: (typeof dayTones)[number]) {
  if (tone === "office") return "rgba(14,165,233,0.35)";
  if (tone === "home") return "rgba(249,115,22,0.28)";
  if (tone === "vacation") return "rgba(34,197,94,0.35)";
  return "rgba(148,163,184,0.28)";
}

function GradientTomorrow() {
  const label = "Tomorrow";
  return (
    <MaskedView maskElement={<Text style={styles.heroWord}>{label}</Text>}>
      <LinearGradient
        colors={["#ea580c", "#f97316", "#0ea5e9", "#8b5cf6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={[styles.heroWord, styles.heroWordGhost]}>{label}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

const FACE = 54;

function FaceMarquee() {
  const shift = useRef(new Animated.Value(0)).current;
  const distance = faces.length * FACE;

  useEffect(() => {
    const motion = Animated.loop(
      Animated.timing(shift, {
        toValue: -distance,
        duration: 16000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    motion.start();
    return () => motion.stop();
  }, [shift, distance]);

  return (
    <View style={styles.marqueeClip}>
      <Animated.View style={[styles.marqueeTrack, { transform: [{ translateX: shift }] }]}>
        {[...faces, ...faces].map((face, index) => (
          <Image
            key={`${face.name}-${index}`}
            source={{ uri: face.photo }}
            style={[styles.face, { borderColor: face.accent }]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function CalendarMock() {
  return (
    <View style={styles.mock}>
      <View style={styles.mockTop}>
        <View style={styles.dots}>
          <View style={[styles.dot, { backgroundColor: "#f87171" }]} />
          <View style={[styles.dot, { backgroundColor: "#fbbf24" }]} />
          <View style={[styles.dot, { backgroundColor: "#4ade80" }]} />
        </View>
        <Text style={styles.mockTitle}>See You Tomorrow</Text>
      </View>
      <View style={styles.mockBody}>
        <View style={styles.mockHead}>
          <Text style={styles.mockLabel}>יומן</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>SEE YOU TOMORROW</Text>
          </View>
        </View>
        <View style={styles.grid}>
          {Array.from({ length: 28 }).map((_, index) => {
            const tone = dayTones[index % dayTones.length];
            const highlighted = index === 10;
            return (
              <View key={index} style={styles.cellWrap}>
                <View
                  style={[
                    styles.cell,
                    { backgroundColor: toneColor(tone) },
                    highlighted && styles.cellHighlight,
                  ]}
                />
              </View>
            );
          })}
        </View>
        <View style={styles.legend}>
          <Text style={[styles.legendChip, { color: "#0ea5e9", backgroundColor: "rgba(14,165,233,0.15)" }]}>במשרד</Text>
          <Text style={[styles.legendChip, { color: "#f97316", backgroundColor: "rgba(249,115,22,0.15)" }]}>בבית</Text>
          <Text style={[styles.legendChip, { color: "#22c55e", backgroundColor: "rgba(34,197,94,0.15)" }]}>חופשה</Text>
        </View>
      </View>
    </View>
  );
}

export default function MarketingHome() {
  const insets = useSafeAreaInsets();
  const { status } = useAuth();

  return (
    <View style={styles.screen}>
      <BrandHeader />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <View style={styles.brandWrap}>
          <View style={styles.brandRow}>
            <View style={styles.brandWords}>
              <Text style={styles.heroWord}>See You </Text>
              <GradientTomorrow />
            </View>
            <Image source={logo} style={styles.chef} />
          </View>
        </View>
        <View style={styles.hero}>
          <Text style={styles.subtitle}>
            פלטפורמה ארגונית לתיאום היברידי — לוחות זמנים, צוותים ומשרדים במקום אחד.
          </Text>
          {status !== "signedIn" ? (
            <>
              <Pressable
                onPress={() => router.push("/login")}
                style={({ pressed }) => [styles.loginButton, pressed && styles.loginPressed]}
              >
                <Text style={styles.loginText}>התחברות</Text>
              </Pressable>
              <Text style={styles.trust}>התחברות מאובטחת · ניהול ארגוני מרכזי</Text>
            </>
          ) : null}
        </View>

        <CalendarMock />

        <Text style={styles.sectionTitle}>צוותים שמתאמים יחד — ביום-יום</Text>
        <FaceMarquee />

        <Text style={styles.sectionTitle}>פעילות חיה במערכת</Text>
        <Text style={styles.sectionHint}>יומן, צוותים והתראות — הכל זז יחד.</Text>
        <View style={styles.cardStack}>
          <View style={styles.card}>
            <LinearGradient colors={["#f97316", "#ea580c"]} style={styles.cardHead}>
              <MaterialIcons name="calendar-month" size={18} color="#fff" />
              <Text style={styles.cardHeadText}>יומן</Text>
            </LinearGradient>
            <Text style={styles.cardHint}>סיכום נוכחות חודשי לפי יום</Text>
          </View>
          <View style={styles.card}>
            <LinearGradient colors={["#0ea5e9", "#6366f1"]} style={styles.cardHead}>
              <MaterialIcons name="groups" size={18} color="#fff" />
              <Text style={styles.cardHeadText}>שקיפות לצוות</Text>
            </LinearGradient>
            <Text style={styles.cardLine}>נועה · משרד</Text>
            <Text style={styles.cardLine}>דוד · בית</Text>
            <Text style={styles.cardLine}>מאיה · משרד</Text>
          </View>
          <View style={styles.card}>
            <LinearGradient colors={["#a78bfa", "#ec4899"]} style={styles.cardHead}>
              <MaterialIcons name="notifications-active" size={18} color="#fff" />
              <Text style={styles.cardHeadText}>התראות</Text>
            </LinearGradient>
            <Text style={styles.cardLine}>3 עובדים במשרד מחר — מחלקת פיתוח</Text>
            <Text style={styles.cardLine}>המלצת AI: לאזן נוכחות במשרד</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  brandWrap: {
    direction: "ltr",
    alignItems: "center",
    paddingTop: 22,
    paddingHorizontal: 16,
  },
  hero: { paddingHorizontal: 20, direction: "rtl", alignItems: "center" },
  brandRow: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
    alignSelf: "center",
    paddingHorizontal: 4,
  },
  chef: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: "rgba(249,115,22,0.35)",
  },
  brandWords: { direction: "ltr", flexDirection: "row", alignItems: "baseline" },
  heroWord: { fontSize: 26, fontWeight: "800", color: colors.ink, writingDirection: "ltr", paddingLeft: 1 },
  heroWordGhost: { opacity: 0 },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "right",
    writingDirection: "rtl",
    marginBottom: 16,
    alignSelf: "stretch",
  },
  loginButton: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  loginPressed: { backgroundColor: colors.orangePressed },
  loginText: { color: "#ffffff", fontSize: 16, fontWeight: "700", writingDirection: "rtl" },
  trust: { color: colors.muted, fontSize: 12, textAlign: "right", writingDirection: "rtl", marginTop: 10, alignSelf: "stretch" },
  mock: {
    marginHorizontal: 20,
    marginTop: 22,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  mockTop: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
  },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  mockTitle: { color: colors.muted, fontSize: 12, fontWeight: "600", writingDirection: "ltr" },
  mockBody: { padding: 12, direction: "rtl" },
  mockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  mockLabel: { color: colors.ink, fontWeight: "700", fontSize: 14, writingDirection: "rtl" },
  badge: {
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.45)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: colors.orange, fontSize: 10, fontWeight: "700", writingDirection: "ltr" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cellWrap: { width: "14.28%", padding: 2 },
  cell: { aspectRatio: 1, borderRadius: 4 },
  cellHighlight: { borderWidth: 2, borderColor: colors.orange },
  legend: { flexDirection: "row", gap: 6, marginTop: 10 },
  legendChip: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: "700" },
  sectionTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    writingDirection: "rtl",
    marginTop: 28,
    paddingHorizontal: 20,
  },
  sectionHint: { color: colors.muted, textAlign: "center", writingDirection: "rtl", marginTop: 6, marginBottom: 4 },
  marqueeClip: { marginTop: 16, overflow: "hidden", alignSelf: "stretch" },
  marqueeTrack: { flexDirection: "row", alignItems: "center", direction: "ltr" },
  face: { width: FACE - 6, height: FACE - 6, borderRadius: (FACE - 6) / 2, borderWidth: 3, marginRight: 6 },
  cardStack: { paddingHorizontal: 20, paddingTop: 12, gap: 12, alignItems: "center" },
  card: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#ffffff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  cardHead: {
    direction: "rtl",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cardHeadText: { color: "#ffffff", fontWeight: "700", fontSize: 14, writingDirection: "rtl" },
  cardHint: { color: colors.muted, fontSize: 13, textAlign: "right", writingDirection: "rtl", padding: 12 },
  cardLine: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
    writingDirection: "rtl",
    marginHorizontal: 12,
    marginBottom: 8,
    backgroundColor: "rgba(14,165,233,0.08)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: "hidden",
  },
});
