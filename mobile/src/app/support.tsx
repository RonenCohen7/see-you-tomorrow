import { MaterialIcons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { t } from "@/locale/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, supportChatRequest } from "@/api/client";
import { canOpen } from "@/auth/access";
import { useAuth } from "@/auth/AuthProvider";
import {
  SUPPORT_CATEGORY_LABEL,
  SUPPORT_FAQ_CATEGORIES,
  SUPPORT_FAQ_ENTRIES,
  quickPickEntries,
  type SupportFaqEntry,
} from "@/help/supportFaq";
import BrandHeader from "@/ui/BrandHeader";
import HomeLink from "@/ui/HomeLink";
import { colors } from "@/ui/theme";

type Bubble = { id: string; from: "user" | "bot"; body: string };
type HistoryItem = { role: "user" | "assistant"; content: string };

const SALES_MAIL = "mailto:sales@seeyoutomorrow.local";

export default function SupportScreen() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seededId = useRef<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return SUPPORT_FAQ_ENTRIES;
    return SUPPORT_FAQ_ENTRIES.filter((entry) =>
      [entry.question, t(entry.question), entry.answer, t(entry.answer), ...entry.keywords].join(" ").toLowerCase().includes(query)
    );
  }, [search]);

  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages, sending]);

  if (status === "signedOut") return <Redirect href="/login" />;
  if (!user) return null;
  if (!canOpen(user.role, "support")) return <Redirect href="/home" />;

  function pick(entry: SupportFaqEntry) {
    setExpandedId(entry.id);
    if (seededId.current === entry.id) return;
    seededId.current = entry.id;
    setMessages([
      { id: "seed-q", from: "user", body: entry.question },
      { id: "seed-a", from: "bot", body: entry.answer },
    ]);
    setHistory([
      { role: "user", content: entry.question },
      { role: "assistant", content: entry.answer },
    ]);
    setError(null);
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput("");
    const userBubble: Bubble = { id: `u-${Date.now()}`, from: "user", body: text };
    setMessages((current) => [...current, userBubble]);
    setSending(true);
    const nextHistory: HistoryItem[] = [...history, { role: "user", content: text }];
    try {
      const { reply } = await supportChatRequest(nextHistory);
      setMessages((current) => [...current, { id: `b-${Date.now()}`, from: "bot", body: reply }]);
      setHistory([...nextHistory, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((current) => current.filter((bubble) => bubble.id !== userBubble.id));
      setInput(text);
      setError(
        err instanceof ApiError && err.message
          ? err.message
          : t("צ'אט AI אינו זמין — עיינו בשאלות הנפוצות או כתבו ל-sales@seeyoutomorrow.local")
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.screen}>
      <BrandHeader greeting={t("מרכז תמיכה")} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <HomeLink />
          <Text style={styles.title}>{t("מרכז תמיכה ועזרה")}</Text>
          <View style={styles.card}>
            <Text style={styles.intro}>
              {t("שאלות נפוצות על התחברות, הרשמה וחשבון. לשאלות על לוחות וניהול — פנו למנהל בארגון. העוזר החכם בתוך האפליקציה מיועד למנהלים בלבד.")}
              </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("שאלות נפוצות")}</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("חיפוש בשאלות…")}
              placeholderTextColor={colors.muted}
              style={styles.search}
             
            />
            <Text style={styles.caption}>{t("נושאים נפוצים")}</Text>
            <View style={styles.chips}>
              {quickPickEntries().map((entry) => (
                <Pressable key={entry.id} onPress={() => pick(entry)} style={styles.chip}>
                  <Text style={styles.chipText}>{t(entry.question)}</Text>
                </Pressable>
              ))}
            </View>
            {filtered.length === 0 ? (
              <Text style={styles.empty}>{t("לא נמצאו תוצאות — נסו ניסוח אחר או צ'אט למטה.")}</Text>
            ) : (
              SUPPORT_FAQ_CATEGORIES.map((category) => {
                const items = filtered.filter((entry) => entry.category === category);
                if (items.length === 0) return null;
                return (
                  <View key={category} style={styles.group}>
                    <Text style={styles.groupTitle}>{t(SUPPORT_CATEGORY_LABEL[category])}</Text>
                    {items.map((entry) => {
                      const open = expandedId === entry.id;
                      return (
                        <View key={entry.id} style={styles.item}>
                          <Pressable
                            onPress={() => setExpandedId(open ? null : entry.id)}
                            style={styles.questionRow}
                          >
                            <Text style={styles.question}>{t(entry.question)}</Text>
                            <MaterialIcons
                              name={open ? "expand-less" : "expand-more"}
                              size={22}
                              color={colors.muted}
                            />
                          </Pressable>
                          {open ? <Text style={styles.answer}>{t(entry.answer)}</Text> : null}
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.chatHead}>
              <MaterialIcons name="support-agent" size={22} color={colors.orange} />
              <Text style={styles.sectionTitle}>{t("צ'אט תמיכה (AI)")}</Text>
            </View>
            <Text style={styles.intro}>{t("שאלו על התחברות, הרשמה, סיסמה ועוד. התשובות מבוססות על מרכז העזרה.")}</Text>
            <View style={styles.note}>
              <Text style={styles.noteText}>{t("בוט תמיכה — אין גישה לנתוני החשבון שלכם. לנושאים ארגוניים פנו למנהל.")}</Text>
            </View>
            <View style={styles.thread}>
              {messages.length === 0 ? (
                <Text style={styles.placeholder}>{t("למשל: לא מצליח להתחבר…")}</Text>
              ) : (
                messages.map((bubble) => (
                  <View
                    key={bubble.id}
                    style={[styles.bubble, bubble.from === "user" ? styles.userBubble : styles.botBubble]}
                  >
                    <Text style={[styles.bubbleText, bubble.from === "user" && styles.userBubbleText]}>
                      {t(bubble.body)}
                    </Text>
                  </View>
                ))
              )}
              {sending ? <ActivityIndicator color={colors.orange} style={styles.spinner} /> : null}
            </View>
            {error ? (
              <Pressable onPress={() => setError(null)} style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </Pressable>
            ) : null}
            <View style={styles.composer}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder={t("למשל: לא מצליח להתחבר…")}
                placeholderTextColor={colors.muted}
                style={styles.composerInput}
               
                editable={!sending}
                multiline
                onFocus={() => scrollRef.current?.scrollToEnd({ animated: true })}
              />
              <Pressable
                onPress={() => void send()}
                disabled={sending || !input.trim()}
                style={({ pressed }) => [
                  styles.send,
                  (!input.trim() || sending) && styles.sendDisabled,
                  pressed && input.trim() && styles.sendPressed,
                ]}
              >
                <Text style={styles.sendText}>{t("שליחה")}</Text>
                <MaterialIcons name="send" size={18} color="#ffffff" style={styles.sendIcon} />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => void Linking.openURL(SALES_MAIL)} style={styles.sales}>
            <Text style={styles.salesText}>{t("יצירת קשר עם המכירות")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    padding: 14,
    marginBottom: 14,
  },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 22, },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "800", },
  search: {
    marginTop: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    color: colors.ink,
    fontSize: 16,
  },
  caption: { color: colors.muted, fontSize: 12, marginTop: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  chip: {
    backgroundColor: "rgba(249,115,22,0.1)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: "100%",
  },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "600", },
  empty: { color: colors.muted, marginTop: 12 },
  group: { marginTop: 12 },
  groupTitle: { color: colors.ink, fontWeight: "700", fontSize: 14, marginBottom: 6 },
  item: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 8 },
  questionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  question: { flex: 1, color: colors.ink, fontWeight: "700", fontSize: 15, },
  answer: { color: colors.muted, fontSize: 14, lineHeight: 22, marginTop: 8 },
  chatHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  note: { backgroundColor: "rgba(14,165,233,0.1)", borderRadius: 10, padding: 10, marginTop: 10 },
  noteText: { color: colors.ink, fontSize: 13, },
  thread: { backgroundColor: "#f1f5f9", borderRadius: 12, padding: 10, marginTop: 12, minHeight: 120, gap: 8 },
  placeholder: { color: colors.muted, padding: 4 },
  bubble: { maxWidth: "92%", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  userBubble: { alignSelf: "flex-start", backgroundColor: colors.orange },
  botBubble: { alignSelf: "flex-end", backgroundColor: "#ffffff" },
  bubbleText: { color: colors.ink, fontSize: 14, lineHeight: 20, },
  userBubbleText: { color: "#ffffff" },
  spinner: { marginVertical: 6 },
  errorBox: { backgroundColor: colors.dangerBg, borderRadius: 10, padding: 10, marginTop: 10 },
  errorText: { color: colors.danger, },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 12 },
  composerInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 16,
    backgroundColor: "#ffffff",
  },
  send: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.orange,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
  },
  sendPressed: { backgroundColor: colors.orangePressed },
  sendDisabled: { opacity: 0.45 },
  sendIcon: { transform: [{ scaleX: -1 }] },
  sendText: { color: "#ffffff", fontWeight: "800", },
  sales: { alignSelf: "center", paddingVertical: 8, marginBottom: 8 },
  salesText: { color: colors.orange, fontWeight: "700", },
});
