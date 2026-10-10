import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthProvider";
import { useLocale } from "@/locale/LocaleProvider";
import { colors } from "./theme";

const logo = require("../../assets/logo.png");

type BrandHeaderProps = {
  greeting?: string;
};

export default function BrandHeader({ greeting }: BrandHeaderProps) {
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const { status } = useAuth();
  const { locale, setLocale } = useLocale();

  function openFromHeader() {
    const onEntry = path === "/" || path === "/index";
    if (status !== "signedIn") {
      if (!onEntry) router.replace("/");
      return;
    }
    if (path === "/home") router.replace("/");
    else router.replace("/home");
  }

  return (
    <LinearGradient
      colors={colors.header}
      locations={[0, 0.45, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0.35 }}
      style={[styles.bar, { paddingTop: insets.top + 8 }]}
    >
      <StatusBar style="light" />
      <View style={styles.langRow}>
        <Pressable
          onPress={() => setLocale("en")}
          style={[styles.langBtn, locale === "en" && styles.langOn]}
          accessibilityRole="button"
          accessibilityLabel="English"
        >
          <Text style={[styles.langText, locale === "en" && styles.langTextOn]}>EN</Text>
        </Pressable>
        <Pressable
          onPress={() => setLocale("he")}
          style={[styles.langBtn, locale === "he" && styles.langOn]}
          accessibilityRole="button"
          accessibilityLabel="עברית"
        >
          <Text style={[styles.langText, locale === "he" && styles.langTextOn]}>עב</Text>
        </Pressable>
      </View>
      <Pressable onPress={openFromHeader} style={styles.center} accessibilityRole="button">
        <View style={styles.row}>
          <Image source={logo} style={styles.logo} />
          <Text style={styles.title}>See You Tomorrow</Text>
        </View>
        {greeting ? (
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}
          </Text>
        ) : null}
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  center: { alignItems: "center" },
  row: {
    direction: "ltr",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  title: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 0,
    textAlign: "center",
    writingDirection: "ltr",
  },
  greeting: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "600",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
  langRow: {
    direction: "ltr",
    flexDirection: "row",
    alignSelf: "flex-end",
    gap: 4,
    marginBottom: 4,
  },
  langBtn: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.45)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  langOn: { backgroundColor: "#ffffff" },
  langText: { color: "#ffffff", fontWeight: "800", fontSize: 12 },
  langTextOn: { color: "#c2410c" },
});
