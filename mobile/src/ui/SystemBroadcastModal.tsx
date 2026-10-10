import { MaterialIcons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { useEffect, useRef, useState } from "react";
import { AppState, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { useAuth } from "@/auth/AuthProvider";

type Broadcast = {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  at: string;
};

const FILL: Record<Broadcast["severity"], string> = {
  info: "#0369a1",
  warning: "#c2410c",
  error: "#b91c1c",
};

export default function SystemBroadcastModal() {
  const { status } = useAuth();
  const [current, setCurrent] = useState<Broadcast | null>(null);
  const [closing, setClosing] = useState(false);
  const announced = useRef(new Set<string>());

  useEffect(() => {
    if (status !== "signedIn") {
      setCurrent(null);
      return;
    }
    let cancelled = false;

    async function load() {
      try {
        const data = await api<{ items: Broadcast[] }>("/api/notifications/system-broadcasts/pending");
        if (cancelled) return;
        const next = data.items[0] ?? null;
        setCurrent(next);
        if (next && AppState.currentState !== "active" && !announced.current.has(next.id)) {
          announced.current.add(next.id);
          void Notifications.scheduleNotificationAsync({
            content: { title: next.title, body: next.message, data: { broadcastId: next.id } },
            trigger: null,
          }).catch(() => undefined);
        }
      } catch {
        /* keep the last message on a brief network miss */
      }
    }

    void load();
    const timer = setInterval(() => void load(), 12_000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [status]);

  async function dismiss() {
    if (!current || closing) return;
    setClosing(true);
    try {
      await api(`/api/notifications/system-broadcasts/${current.id}/dismiss`, { method: "POST" });
      setCurrent(null);
    } catch {
      /* leave it open so it is not lost */
    } finally {
      setClosing(false);
    }
  }

  return (
    <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        {current ? (
          <View style={[styles.card, { backgroundColor: FILL[current.severity] }]}>
            <View style={styles.head}>
              <Text style={styles.title}>{current.title}</Text>
              <Pressable
                onPress={() => void dismiss()}
                disabled={closing}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="סגירה"
              >
                <MaterialIcons name="close" size={26} color="#ffffff" />
              </Pressable>
            </View>
            <Text style={styles.message}>{current.message}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  card: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  message: {
    marginTop: 10,
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "right",
    writingDirection: "rtl",
  },
});
