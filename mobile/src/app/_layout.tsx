import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/auth/AuthProvider";
import SignedInSwipe from "@/ui/SignedInSwipe";
import { colors } from "@/ui/theme";

I18nManager.allowRTL(true);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <SignedInSwipe>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: "fade",
            }}
          />
        </SignedInSwipe>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
