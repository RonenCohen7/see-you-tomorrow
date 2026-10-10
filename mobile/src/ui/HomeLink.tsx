import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { useLocale } from "@/locale/LocaleProvider";
import { t } from "@/locale/i18n";
import { colors } from "@/ui/theme";

export default function HomeLink() {
  const { locale } = useLocale();
  return (
    <Pressable onPress={() => router.replace("/home")} style={styles.link} hitSlop={8}>
      <MaterialIcons name={locale === "he" ? "arrow-forward" : "arrow-back"} size={20} color={colors.orange} />
      <Text style={styles.text}>{t("בית")}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 8 },
  text: { color: colors.orange, fontWeight: "800" },
});
