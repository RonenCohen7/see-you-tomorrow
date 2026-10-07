import { Redirect, router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, cleanLoginEmail, cleanSecret } from "@/api/client";
import { bundledApiUrl, readApiUrl } from "@/api/session";
import { useAuth } from "@/auth/AuthProvider";
import BrandHeader from "@/ui/BrandHeader";
import { colors } from "@/ui/theme";

export default function LoginScreen() {
  const { status, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [apiUrl, setApiUrl] = useState(bundledApiUrl());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const showServer = !bundledApiUrl().startsWith("https://");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void readApiUrl().then(setApiUrl);
  }, []);

  if (status === "signedIn") return <Redirect href="/home" />;

  async function submit() {
    setError(null);
    const cleanEmail = cleanLoginEmail(email);
    const cleanPassword = cleanSecret(password);
    if (!cleanEmail || !cleanPassword) {
      setError("מלאו אימייל וסיסמה.");
      return;
    }
    if (!cleanEmail.includes("@")) {
      setError("האימייל צריך להיות הכתובת מהאתר, באנגלית. לא השם שמופיע בפרופיל.");
      return;
    }
    setSubmitting(true);
    try {
      await login({
        email: cleanEmail,
        password: cleanPassword,
        tenantSlug,
        apiUrl,
      });
      router.replace("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ההתחברות נכשלה.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <BrandHeader />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>התחברות</Text>
          <Text style={styles.tagline}>תיאום עבודה היברידי — פשוט ובהיר</Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>קוד חברה</Text>
          <TextInput
            value={tenantSlug}
            onChangeText={setTenantSlug}
            autoCapitalize="none"
            autoCorrect={false}
            textAlign="left"
            style={[styles.input, styles.ltrInput]}
            placeholder="למשל 88"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>אימייל</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            inputMode="email"
            textContentType="emailAddress"
            autoComplete="email"
            textAlign="left"
            style={[styles.input, styles.ltrInput]}
            placeholder="name@company.com"
            placeholderTextColor={colors.muted}
          />

          <Text style={styles.label}>סיסמה</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            autoComplete="password"
            textAlign="left"
            style={[styles.input, styles.ltrInput]}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
          />

          {showServer ? (
            <>
              <Text style={styles.label}>כתובת השרת המקומי</Text>
              <TextInput
                value={apiUrl}
                onChangeText={setApiUrl}
                autoCapitalize="none"
                autoCorrect={false}
                textAlign="left"
                style={[styles.input, styles.serverInput]}
                placeholder="http://10.0.0.12:4000"
                placeholderTextColor={colors.muted}
              />
            </>
          ) : null}

          <Pressable
            onPress={() => void submit()}
            disabled={submitting}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>התחברות</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 22, direction: "rtl" },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", marginBottom: 6, textAlign: "right", writingDirection: "rtl" },
  tagline: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 22, textAlign: "right", writingDirection: "rtl" },
  errorBox: {
    backgroundColor: colors.dangerBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: colors.danger, fontSize: 15, lineHeight: 22, textAlign: "right", writingDirection: "rtl" },
  label: { color: colors.ink, fontSize: 14, fontWeight: "600", marginBottom: 6, textAlign: "right", writingDirection: "rtl" },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 14,
  },
  ltrInput: { textAlign: "left", writingDirection: "ltr" },
  serverInput: { textAlign: "left", writingDirection: "ltr" },
  button: {
    backgroundColor: colors.orange,
    borderRadius: 16,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  buttonPressed: { backgroundColor: colors.orangePressed },
  buttonText: { color: "#ffffff", fontSize: 17, fontWeight: "700" },
});
