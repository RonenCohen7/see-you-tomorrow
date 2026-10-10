import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { t } from "@/locale/i18n";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Ask once for notification and location approval. A denial is left as-is. */
export async function requestDevicePermissions(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("system-messages", {
        name: t("הודעות מערכת"),
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
    const notes = await Notifications.getPermissionsAsync();
    if (notes.status !== "granted") {
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    /* Expo Go on some devices cannot show the prompt */
  }

  try {
    const place = await Location.getForegroundPermissionsAsync();
    if (place.status !== "granted") {
      await Location.requestForegroundPermissionsAsync();
    }
  } catch {
    /* permission API unavailable */
  }
}
