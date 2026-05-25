import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha,
} from "@mui/material";
import { type FormEventHandler, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PublicTurnstileField, { hasTurnstileSiteKey } from "../PublicTurnstileField";
import { postSupportChat, type SupportChatMessage } from "../../services/supportChat";
import { getFaqAnswer, getFaqQuestion, type SupportFaqEntry, type SupportLocale } from "../../help/supportFaqBank";

type Bubble = { id: string; from: "user" | "bot"; body: string };

type Props = {
  /** Prefill chat when user clicks FAQ chip */
  seedEntry?: SupportFaqEntry | null;
};

export function SupportAiChat({ seedEntry }: Props) {
  const { t, i18n } = useTranslation();
  const locale = (i18n.language === "en" ? "en" : "he") as SupportLocale;
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [history, setHistory] = useState<SupportChatMessage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileUsed, setTurnstileUsed] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, processing]);

  useEffect(() => {
    if (!seedEntry || seededRef.current === seedEntry.id) return;
    seededRef.current = seedEntry.id;
    const q = getFaqQuestion(seedEntry, locale);
    const a = getFaqAnswer(seedEntry, locale);
    setMessages([
      { id: "seed-q", from: "user", body: q },
      { id: "seed-a", from: "bot", body: a },
    ]);
    setHistory([
      { role: "user", content: q },
      { role: "assistant", content: a },
    ]);
  }, [seedEntry, locale]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || processing) return;

    if (hasTurnstileSiteKey() && !turnstileToken?.trim()) {
      setError(t("turnstileRequired"));
      return;
    }

    setError(null);
    setInput("");
    const userBubble: Bubble = { id: `u-${Date.now()}`, from: "user", body: text };
    setMessages((m) => [...m, userBubble]);
    setProcessing(true);

    const nextHistory: SupportChatMessage[] = [...history, { role: "user", content: text }];

    try {
      const { reply } = await postSupportChat({
        messages: nextHistory,
        locale,
        turnstileToken: turnstileUsed ? undefined : turnstileToken,
      });
      if (!turnstileUsed && turnstileToken) setTurnstileUsed(true);
      const botBubble: Bubble = { id: `b-${Date.now()}`, from: "bot", body: reply };
      setMessages((m) => [...m, botBubble]);
      setHistory([...nextHistory, { role: "assistant", content: reply }]);
    } catch {
      setError(t("supportChatUnavailable"));
      setMessages((m) => m.filter((b) => b.id !== userBubble.id));
    } finally {
      setProcessing(false);
    }
  }, [input, processing, turnstileToken, turnstileUsed, history, locale, t]);

  const onSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    void send();
  };

  return (
    <Paper
      variant="outlined"
      sx={(th) => ({
        p: 2,
        bgcolor: alpha(th.palette.background.paper, th.palette.mode === "dark" ? 0.88 : 0.96),
        backdropFilter: "blur(10px)",
      })}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <SupportAgentIcon color="primary" />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {t("supportChatTitle")}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t("supportChatIntro")}
      </Typography>
      <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
        {t("supportChatDisclaimer")}
      </Alert>

      <Box
        ref={listRef}
        sx={{
          minHeight: 160,
          maxHeight: 280,
          overflowY: "auto",
          mb: 2,
          p: 1,
          borderRadius: 1,
          bgcolor: "action.hover",
        }}
      >
        {messages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            {t("supportChatPlaceholder")}
          </Typography>
        )}
        <Stack spacing={1}>
          {messages.map((b) => (
            <Box
              key={b.id}
              sx={{
                alignSelf: b.from === "user" ? "flex-start" : "flex-end",
                maxWidth: "92%",
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: b.from === "user" ? "primary.main" : "background.paper",
                color: b.from === "user" ? "primary.contrastText" : "text.primary",
                boxShadow: 1,
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                {b.body}
              </Typography>
            </Box>
          ))}
          {processing && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
              <CircularProgress size={22} />
            </Box>
          )}
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!turnstileUsed && <PublicTurnstileField onTokenChange={setTurnstileToken} />}

      <Box component="form" onSubmit={onSubmit}>
        <TextField
          fullWidth
          size="small"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("supportChatPlaceholder")}
          disabled={processing}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  type="submit"
                  size="small"
                  variant="contained"
                  disabled={processing || !input.trim()}
                  endIcon={<SendRoundedIcon fontSize="small" />}
                >
                  {t("supportChatSend")}
                </Button>
              </InputAdornment>
            ),
          }}
        />
      </Box>
    </Paper>
  );
}
