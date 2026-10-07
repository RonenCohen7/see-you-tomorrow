import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, router } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import { colors, roleLabel } from "@/ui/theme";

export default function HomeScreen() {
  const { status, user, logout } = useAuth();
  const insets = useSafeAreaInsets();

  if (status === "signedOut") return <Redirect href="/" />;
  if (!user) return null;

  const initials = user.fullName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={`שלום, ${user.fullName}`} />
      <ScrollView contentContainerStyle={styles.content}>
        {canOpen(user.role, "calendar") ? (
          <Pressable
            onPress={() => router.push("/calendar")}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.calendarPressed]}
          >
            <MaterialIcons name="calendar-month" size={22} color="#ffffff" />
            <Text style={styles.calendarButtonText}>יומן</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "preferences") ? (
          <Pressable
            onPress={() => router.push("/preferences")}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.calendarPressed]}
          >
            <MaterialIcons name="event-available" size={22} color="#ffffff" />
            <Text style={styles.calendarButtonText}>העדפות שיבוץ</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "teamPreferences") ? (
          <Pressable
            onPress={() => router.push("/team-preferences")}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.calendarPressed]}
          >
            <MaterialIcons name="fact-check" size={22} color="#ffffff" />
            <Text style={styles.calendarButtonText}>העדפות צוות</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "notifications") ? (
          <Pressable
            onPress={() => router.push("/notifications")}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.calendarPressed]}
          >
            <MaterialIcons name="notifications-active" size={22} color="#ffffff" />
            <Text style={styles.calendarButtonText}>התראות</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "ai") ? (
          <Pressable
            onPress={() => router.push("/ai")}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.calendarPressed]}
          >
            <MaterialIcons name="auto-awesome" size={22} color="#ffffff" />
            <Text style={styles.calendarButtonText}>המלצות AI</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "myParking") ? (
          <Pressable
            onPress={() => router.push("/my-parking")}
            style={({ pressed }) => [styles.calendarButton, pressed && styles.calendarPressed]}
          >
            <MaterialIcons name="directions-car" size={22} color="#ffffff" />
            <Text style={styles.calendarButtonText}>תפיסת חנייה</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "schedulingRules") ? (
          <Pressable
            onPress={() => router.push("/scheduling-rules")}
            style={({ pressed }) => [styles.deptButton, pressed && styles.deptPressed]}
          >
            <MaterialIcons name="policy" size={22} color={colors.orange} />
            <Text style={styles.deptButtonText}>חוקי שיבוץ</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "parking") ? (
          <Pressable
            onPress={() => router.push("/parking")}
            style={({ pressed }) => [styles.deptButton, pressed && styles.deptPressed]}
          >
            <MaterialIcons name="local-parking" size={22} color={colors.orange} />
            <Text style={styles.deptButtonText}>ניהול חניות</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "departments") ? (
          <Pressable
            onPress={() => router.push("/departments")}
            style={({ pressed }) => [styles.deptButton, pressed && styles.deptPressed]}
          >
            <MaterialIcons name="apartment" size={22} color={colors.orange} />
            <Text style={styles.deptButtonText}>מחלקות</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "locations") ? (
          <Pressable
            onPress={() => router.push("/locations")}
            style={({ pressed }) => [styles.deptButton, pressed && styles.deptPressed]}
          >
            <MaterialIcons name="place" size={22} color={colors.orange} />
            <Text style={styles.deptButtonText}>מיקומים</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "employees") ? (
          <Pressable
            onPress={() => router.push("/employees")}
            style={({ pressed }) => [styles.deptButton, pressed && styles.deptPressed]}
          >
            <MaterialIcons name="groups" size={22} color={colors.orange} />
            <Text style={styles.deptButtonText}>עובדים</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "settings") ? (
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [styles.deptButton, pressed && styles.deptPressed]}
          >
            <MaterialIcons name="settings" size={22} color={colors.orange} />
            <Text style={styles.deptButtonText}>הגדרות</Text>
          </Pressable>
        ) : null}
        {canOpen(user.role, "support") ? (
          <Pressable
            onPress={() => router.push("/support")}
            style={({ pressed }) => [styles.deptButton, pressed && styles.deptPressed]}
          >
            <MaterialIcons name="support-agent" size={22} color={colors.orange} />
            <Text style={styles.deptButtonText}>מרכז תמיכה</Text>
          </Pressable>
        ) : null}
        <View style={styles.card}>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "S"}</Text>
            </View>
            <View style={styles.identityText}>
              <Text style={styles.name}>{user.fullName}</Text>
              <Text style={styles.email}>{user.email}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.cardLabel}>תפקיד</Text>
          <Text style={styles.cardValue}>{roleLabel[user.role] ?? user.role}</Text>
          {user.jobTitle ? (
            <>
              <Text style={styles.cardLabel}>תפקיד בעבודה</Text>
              <Text style={styles.cardValue}>{user.jobTitle}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.spacer} />
        <Pressable
          onPress={() => void logout()}
          style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
        >
          <MaterialIcons name="logout" size={22} color={colors.muted} />
          <Text style={styles.logoutText}>התנתקות</Text>
        </Pressable>
      </ScrollView>
      <LinearGradient
        colors={colors.header}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.35 }}
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <Text style={styles.footerText}>פיתוח ע״י </Text>
        <Pressable onPress={() => void Linking.openURL("https://ronencohen.dev")} hitSlop={8}>
          <Text style={styles.footerLink}>ronencohen.dev</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, direction: "rtl", flexGrow: 1 },
  spacer: { flexGrow: 1, minHeight: 16 },
  calendarButton: {
    direction: "rtl",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.orange,
    borderRadius: 14,
    minHeight: 48,
    marginBottom: 14,
  },
  calendarPressed: { backgroundColor: colors.orangePressed },
  calendarButtonText: { color: "#ffffff", fontSize: 17, fontWeight: "800", writingDirection: "rtl" },
  deptButton: {
    direction: "rtl",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.45)",
    minHeight: 48,
    marginBottom: 14,
  },
  deptPressed: { backgroundColor: "rgba(249,115,22,0.12)" },
  deptButtonText: { color: colors.ink, fontSize: 17, fontWeight: "800", writingDirection: "rtl" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    padding: 16,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontWeight: "700", fontSize: 16 },
  identityText: { flex: 1, alignItems: "flex-end" },
  name: { color: colors.ink, fontSize: 18, fontWeight: "700", textAlign: "right", writingDirection: "rtl" },
  email: { color: colors.muted, fontSize: 14, textAlign: "left", writingDirection: "ltr", marginTop: 2, alignSelf: "stretch" },
  divider: { height: 1, backgroundColor: colors.line, marginTop: 14 },
  cardLabel: { color: colors.muted, fontSize: 13, textAlign: "right", writingDirection: "rtl", marginTop: 12 },
  cardValue: { color: colors.ink, fontSize: 16, fontWeight: "600", textAlign: "right", writingDirection: "rtl" },
  logout: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 10,
    paddingHorizontal: 12,
  },
  logoutPressed: { backgroundColor: "rgba(249,115,22,0.12)" },
  logoutText: { color: colors.ink, fontSize: 16, fontWeight: "600", writingDirection: "rtl" },
  footer: {
    direction: "rtl",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  footerText: { color: "#ffffff", fontSize: 13, fontWeight: "600", writingDirection: "rtl" },
  footerLink: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
    textDecorationLine: "underline",
    writingDirection: "ltr",
  },
});
