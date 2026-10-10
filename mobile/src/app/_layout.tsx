import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { I18nManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/auth/AuthProvider";
import { requestDevicePermissions } from "@/ui/devicePermissions";
import SignedInSwipe from "@/ui/SignedInSwipe";
import SystemBroadcastModal from "@/ui/SystemBroadcastModal";
import { colors } from "@/ui/theme";

I18nManager.allowRTL(true);

function SignedInShell() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "signedIn") return;
    void requestDevicePermissions();
  }, [status]);

  return (
    <>
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
      <SystemBroadcastModal />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SignedInShell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
