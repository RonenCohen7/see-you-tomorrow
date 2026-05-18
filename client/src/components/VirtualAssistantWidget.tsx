import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HelpOutlineRoundedIcon from "@mui/icons-material/HelpOutlineRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import {
  Badge,
  Box,
  Chip,
  CircularProgress,
  Fab,
  GlobalStyles,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
  alpha,
  keyframes,
  useTheme,
} from "@mui/material";
import type { AxiosInstance } from "axios";
import { useQuery } from "@tanstack/react-query";
import {
  type FormEventHandler,
  type KeyboardEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import type { Role } from "../types/models";
import api from "../services/api";
import { postAssistantChat, type AssistantChatMessage } from "../services/assistantAgent";
import { classifyAssistantMessage, fulfillAssistantIntent } from "../utils/virtualAssistantIntents";

type Bubble = {
  id: string;
  from: "user" | "bot";
  body: string;
  pending?: boolean;
};

/** Path → existing MainLayout sidebar `t(key)` ids */
const ROUTE_LABEL_KEY: Partial<Record<string, string>> = {
  "/dashboard": "dashboard",
  "/calendar": "calendar",
  "/meeting-rooms": "meetingRooms",
  "/preferences": "attendancePrefs",
  "/employees": "employees",
  "/departments": "departments",
  "/locations": "locations",
  "/scheduling-rules": "schedulingRules",
  "/schedules": "schedules",
  "/team-preferences": "teamAttendancePrefs",
  "/preference-ai-queue": "preferenceAiQueueNav",
  "/parking": "parking",
  "/reports": "reports",
  "/ai": "ai",
  "/notifications": "notifications",
  "/profile": "profile",
  "/settings": "settings",
};

type Props = {
  role: Role;
  onOpenScreenHelp: () => void;
};

const WA_GREEN = "#25D366";

const fabFloatAnim = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
`;

/** hybrid: rules for fast paths; Claude when unknown. agent_only: Claude for data (nav/help stay local). */
const ASSISTANT_MODE: "hybrid" | "agent_only" = "hybrid";

export function VirtualAssistantWidget({ role, onOpenScreenHelp }: Props) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [processing, setProcessing] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const greetingInjectedRef = useRef(false);

  const outgoingAlign = theme.direction === "rtl" ? "flex-start" : "flex-end";
  const incomingAlign = theme.direction === "rtl" ? "flex-end" : "flex-start";

  const { data: departmentOptions = [] } = useQuery({
    queryKey: ["virtual-assistant-departments", i18n.language],
    queryFn: async () => {
      const { data } = await api.get<{
        items: { id: string; name: string; isActive?: boolean }[];
      }>("/api/departments");
      return data.items
        .filter((d) => d.name?.trim() && (d.isActive ?? true))
        .map((d) => ({ id: d.id, name: d.name }));
    },
    staleTime: 5 * 60_000,
  });

  const exampleChips = useMemo(
    () => [
      t("assistantChipSchedules"),
      t("assistantChipHomeToday"),
      t("assistantChipDeptVacation"),
      t("assistantChipManagerOffice"),
    ],
    [t],
  );

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (open && !greetingInjectedRef.current) {
      greetingInjectedRef.current = true;
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-greeting`;
      setMessages([{ id, from: "bot", body: `${t("assistantIntroTitle")}\n\n${t("assistantIntroBody")}` }]);
    }
    if (!open) {
      /** keep greeting once logged in tab — only reset greeting when navigating away handled by umount optional */
      greetingInjectedRef.current = greetingInjectedRef.current;
    }
  }, [open, t]);

  const routeLabelForPath = useCallback(
    (path: string): string => {
      const nk = ROUTE_LABEL_KEY[path];
      return nk ? t(nk) : path;
    },
    [t],
  );

  const callSmartAgent = useCallback(
    async (userText: string, priorMessages: Bubble[]) => {
      const history: AssistantChatMessage[] = priorMessages
        .filter((m) => !m.pending && m.body.trim())
        .slice(-12)
        .map((m) => ({
          role: m.from === "user" ? ("user" as const) : ("assistant" as const),
          content: m.body,
        }));
      history.push({ role: "user", content: userText });

      const res = await postAssistantChat({
        messages: history,
        locale: i18n.language,
        mode: ASSISTANT_MODE,
        pathname: location.pathname,
      });
      if (res.navigateTo) {
        navigate(res.navigateTo);
      }
      return res.reply;
    },
    [i18n.language, location.pathname, navigate],
  );

  const applyIntent = useCallback(
    async (rawText: string, client: AxiosInstance, priorMessages: Bubble[]) => {
      const intent = classifyAssistantMessage(rawText, departmentOptions, role);

      if (intent.kind === "help-screen") {
        onOpenScreenHelp();
        return t("assistantAckHelpOverlay");
      }
      if (intent.kind === "nav") {
        navigate(intent.to);
        return t("assistantAckNav", { destination: routeLabelForPath(intent.to) });
      }

      const useSmartAgent =
        intent.kind === "unknown" ||
        (ASSISTANT_MODE === "agent_only" &&
          intent.kind !== "explain" &&
          intent.kind !== "clarify");

      if (useSmartAgent) {
        try {
          return await callSmartAgent(rawText, priorMessages);
        } catch {
          if (intent.kind !== "unknown") {
            return fulfillAssistantIntent(intent, { client, t, role });
          }
          throw new Error("agent_failed");
        }
      }

      return fulfillAssistantIntent(intent, { client, t, role });
    },
    [
      callSmartAgent,
      departmentOptions,
      navigate,
      onOpenScreenHelp,
      role,
      routeLabelForPath,
      t,
    ],
  );

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || processing) return;

    const userId =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-u`;
    const botId =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-b`;

    setMessages((m) => [
      ...m,
      { id: userId, from: "user", body: trimmed },
      { id: botId, from: "bot", body: "", pending: true },
    ]);
    setInput("");
    setProcessing(true);

    try {
      const prior = messages;
      const reply = await applyIntent(trimmed, api as AxiosInstance, prior);
      setMessages((m) => m.map((x) => (x.id === botId ? { ...x, pending: false, body: reply } : x)));
    } catch {
      setMessages((m) =>
        m.map((x) =>
          x.id === botId ? { ...x, pending: false, body: t("assistantAgentError") } : x,
        ),
      );
    }
    setProcessing(false);
  };

  const chipFill = useCallback((q: string) => {
    setInput(q);
  }, []);

  const onSubmit: FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    void send();
  };

  const onKey: KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <>
      <GlobalStyles
        styles={{
          "@keyframes sytVaTyping": {
            "0%, 80%, 100%": { transform: "scale(0.6)", opacity: 0.35 },
            "40%": { transform: "scale(1)", opacity: 1 },
          },
        }}
      />
      <Box
        sx={{
          position: "relative",
          pointerEvents: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
        }}
      >
        {open ? (
          <Paper
            elevation={12}
            sx={{
              position: "absolute",
              bottom: 64,
              right: ({ direction }) => (direction === "rtl" ? "auto" : 0),
              left: ({ direction }) => (direction === "rtl" ? 0 : "auto"),
            width: { xs: "calc(100vw - 24px)", sm: 360 },
              maxHeight: `min(72vh, 520px)` as `${number}px`,
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 3,
              border: (th) => `1px solid ${alpha(th.palette.divider, 0.9)}`,
              bgcolor: "background.paper",
            }}
          >
            <Box
              sx={{
                px: 2,
                py: 1.25,
                display: "flex",
                alignItems: "center",
                gap: 1,
                background: `linear-gradient(125deg, ${WA_GREEN}dc 10%, ${alpha(WA_GREEN, 0.8)} 100%)`,
                color: "#fff",
              }}
            >
              <Box
                component="img"
                src="/help-avatar.png"
                alt=""
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1.6,
                  border: `2px solid ${alpha("#fff", 0.92)}`,
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  {t("assistantHeaderTitle")}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, display: "block", lineHeight: 1.3 }}>
                  {t("assistantHeaderSubtitle")}
                </Typography>
              </Box>
              <IconButton size="small" aria-label={t("assistantHelpScreenAria")} onClick={() => onOpenScreenHelp()} sx={{ color: "#fff" }}>
                <HelpOutlineRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label={t("assistantCloseAria")}
                onClick={() => setOpen(false)}
                sx={{ color: "#fff" }}
              >
                <CloseRoundedIcon fontSize="small" />
              </IconButton>
            </Box>

            <Box sx={{ px: 1.25, py: 1.1, borderBottom: 1, borderColor: "divider", bgcolor: "action.hover" }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: "block" }}>
                {t("assistantExamplesLabel")}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.65 }}>
                {exampleChips.map((c) => (
                  <Chip
                    key={c}
                    size="small"
                    label={c}
                    onClick={() => chipFill(c)}
                    sx={{
                      borderRadius: 2,
                      bgcolor: alpha(WA_GREEN, 0.1),
                      [`& .MuiChip-label`]: { py: 0.9, px: 0.85, whiteSpace: "normal", textAlign: "start" },
                    }}
                  />
                ))}
              </Box>
            </Box>

            <Box
              ref={listRef}
              sx={{
                flex: 1,
                overflowY: "auto",
                px: 1.35,
                py: 1.2,
                display: "flex",
                flexDirection: "column",
                gap: 1,
                minHeight: 216,
              }}
            >
              {messages.map((msg) =>
                msg.from === "user" ? (
                  <Paper
                    key={msg.id}
                    elevation={0}
                    sx={{
                      alignSelf: outgoingAlign,
                      maxWidth: "92%",
                      px: 1.25,
                      py: 1,
                      borderRadius: "16px",
                      bgcolor: alpha(WA_GREEN, 0.14),
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    <Typography variant="body2">{msg.body}</Typography>
                  </Paper>
                ) : (
                  <Paper
                    key={msg.id}
                    elevation={0}
                    sx={{
                      alignSelf: incomingAlign,
                      maxWidth: "94%",
                      px: 1.35,
                      py: 1.1,
                      borderRadius: "16px",
                      bgcolor: () =>
                        alpha(
                          theme.palette.mode === "dark" ? theme.palette.grey[200] : theme.palette.grey[800],
                          theme.palette.mode === "dark" ? 0.16 : 0.93,
                        ),
                      color:
                        theme.palette.mode === "dark" ? theme.palette.text.primary : theme.palette.grey[50],
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      minHeight: msg.pending ? 44 : undefined,
                      display: "flex",
                      alignItems: msg.pending ? "center" : "stretch",
                      justifyContent: msg.pending ? "flex-start" : "flex-start",
                    }}
                  >
                    {msg.pending ? (
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, px: 0.5 }}>
                        {[0, 1, 2].map((i) => (
                          <Box
                            key={String(i)}
                            sx={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              bgcolor: WA_GREEN,
                              animation: `sytVaTyping 1s ease-in-out infinite ${i * 0.18}s`,
                            }}
                          />
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ lineHeight: 1.52 }}>
                        {msg.body || t("assistantEmptyReply")}
                      </Typography>
                    )}
                  </Paper>
                ),
              )}
            </Box>

            <Box component="form" onSubmit={onSubmit} sx={{ p: 1.35, borderTop: 1, borderColor: "divider" }}>
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={4}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("assistantInputPlaceholder")}
                disabled={processing}
                onKeyDown={onKey}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        type="submit"
                        aria-label={t("assistantSendAria")}
                        disabled={processing}
                      >
                        {processing ? (
                          <CircularProgress size={20} sx={{ color: WA_GREEN }} />
                        ) : (
                          <SendRoundedIcon sx={{ color: WA_GREEN }} />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </Paper>
        ) : null}

        <Badge color="secondary" variant="dot" invisible={open} overlap="circular">
          <Fab
            aria-label={t("assistantFabAria")}
            sx={{
              animation: `${fabFloatAnim} 3.4s ease-in-out infinite`,
              boxShadow: (th) =>
                `0 10px 24px ${alpha(th.palette.success.main, 0.36)}, 0 3px 8px rgba(0,0,0,0.18)`,
              bgcolor: WA_GREEN,
              color: "#fff",
              flexShrink: 0,
              "&:hover": { bgcolor: alpha(WA_GREEN, 0.93) },
            }}
            onClick={() => setOpen((v) => !v)}
            size="large"
          >
            <SmartToyOutlinedIcon />
          </Fab>
        </Badge>
      </Box>
    </>
  );
}
