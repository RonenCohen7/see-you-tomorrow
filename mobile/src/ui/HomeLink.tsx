import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/ui/theme";

export default function HomeLink() {
  return (
    <Pressable onPress={() => router.replace("/home")} style={styles.link} hitSlop={8}>
      <MaterialIcons name="arrow-forward" size={20} color={colors.orange} />
      <Text style={styles.text}>בית</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 8 },
  text: { color: colors.orange, fontWeight: "800", writingDirection: "rtl" },
});
