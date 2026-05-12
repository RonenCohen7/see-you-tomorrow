import CloseIcon from "@mui/icons-material/Close";
import ReplayIcon from "@mui/icons-material/Replay";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  Button,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { getHelpSegments, helpScreenTitleKey } from "../help/screenHelpScripts";
import {
  normalizeTextForTts,
  pickHebrewVoice,
  utteranceLangForVoice,
} from "../utils/helpScreenTts";

export { normalizeTextForTts } from "../utils/helpScreenTts";

const AVATAR_SRC = "/help-avatar.png";

const VOICE_POLL_MAX = 12;
const VOICE_POLL_MS = 100;

export type ScreenHelpOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function ScreenHelpOverlay({ open, onClose }: ScreenHelpOverlayProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [muted, setMuted] = useState(false);
  const [caption, setCaption] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [noHebrewVoice, setNoHebrewVoice] = useState(false);

  const segments = useMemo(() => getHelpSegments(pathname), [pathname]);
  const screenTitleKey = useMemo(() => helpScreenTitleKey(pathname), [pathname]);

  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setMuted(false);
    }
    prevOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const synth = window.speechSynthesis;
    const refresh = () => {
      synth.getVoices();
    };
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, [open]);

  useEffect(() => {
    if (!open) setNoHebrewVoice(false);
  }, [open]);

  useEffect(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setCaption("");
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return undefined;
    }

    if (muted) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setNoHebrewVoice(false);
      setCaption(segments.map((s) => s.text).join("\n\n"));
      return undefined;
    }

    let cancelled = false;
    let idx = 0;
    const timeouts: number[] = [];

    const flushTimeouts = () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      timeouts.length = 0;
    };

    const runNext = () => {
      if (cancelled || idx >= segments.length) {
        flushTimeouts();
        setSpeaking(false);
        return;
      }

      const proceed = () => {
        if (cancelled || idx >= segments.length) {
          flushTimeouts();
          setSpeaking(false);
          return;
        }
        const text = segments[idx].text;
        setCaption(text);
        const forSpeech = normalizeTextForTts(text);
        const u = new SpeechSynthesisUtterance(forSpeech || text);
        const voice = pickHebrewVoice();
        if (idx === 0) {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0 && !voice) setNoHebrewVoice(true);
          else setNoHebrewVoice(false);
        }
        u.lang = utteranceLangForVoice(voice);
        u.rate = 0.84;
        u.pitch = 1;
        if (voice) u.voice = voice;
        let finished = false;
        const advance = () => {
          if (cancelled || finished) return;
          finished = true;
          idx += 1;
          runNext();
        };
        u.onstart = () => {
          if (!cancelled) setSpeaking(true);
        };
        u.onend = advance;
        u.onerror = advance;
        window.speechSynthesis.speak(u);
      };

      if (idx === 0) {
        const poll = (attempt: number) => {
          if (cancelled) return;
          window.speechSynthesis.getVoices();
          const voices = window.speechSynthesis.getVoices();
          if (voices.length === 0 && attempt < VOICE_POLL_MAX) {
            timeouts.push(window.setTimeout(() => poll(attempt + 1), VOICE_POLL_MS));
            return;
          }
          proceed();
        };
        poll(0);
        return;
      }

      proceed();
    };

    window.speechSynthesis.cancel();
    runNext();

    return () => {
      cancelled = true;
      flushTimeouts();
      window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [open, muted, pathname, segments, restartToken]);

  const closeDialog = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    onClose();
  }, [onClose]);

  const replay = useCallback(() => {
    window.speechSynthesis.cancel();
    setRestartToken((x) => x + 1);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  return (
    <>
      <GlobalStyles
        styles={{
          "@keyframes sytHelpTalk": {
            "0%, 100%": { transform: "scale(1)", filter: "brightness(1)" },
            "50%": { transform: "scale(1.035)", filter: "brightness(1.06)" },
          },
        }}
      />

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm" aria-labelledby="syt-help-dialog-title">
        <DialogTitle id="syt-help-dialog-title">
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography component="span" variant="h6" fontWeight={800}>
              {t("helpDialogTitle")}
              {screenTitleKey ? (
                <Typography component="span" variant="subtitle1" color="text.secondary" sx={{ display: "block", fontWeight: 600, mt: 0.25 }}>
                  — {t(screenTitleKey)}
                </Typography>
              ) : null}
            </Typography>
            <IconButton onClick={closeDialog} aria-label={t("helpClose")} edge="end" size="small">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "center", sm: "flex-start" }}>
            <Box
              sx={{
                flexShrink: 0,
                width: { xs: 140, sm: 160 },
                borderRadius: 2,
                overflow: "hidden",
                border: "2px solid",
                borderColor: "divider",
                boxShadow: 1,
                animation: speaking ? "sytHelpTalk 0.9s ease-in-out infinite" : "none",
              }}
            >
              <Box component="img" src={AVATAR_SRC} alt="" sx={{ width: "100%", height: "auto", display: "block" }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
              <Typography
                variant="body1"
                sx={{ lineHeight: 1.65, whiteSpace: "pre-wrap", fontWeight: 600 }}
                aria-live="polite"
                role="status"
              >
                {caption || "\u00a0"}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5, lineHeight: 1.5 }}>
                {t("helpTtsHint")}
              </Typography>
              {noHebrewVoice ? (
                <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 1, lineHeight: 1.5 }}>
                  {t("helpTtsNoHebrewVoice")}
                </Typography>
              ) : null}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: "wrap", gap: 1, px: 2, py: 1.5 }}>
          <Tooltip title={muted ? t("helpUnmute") : t("helpMute")} arrow>
            <IconButton color={muted ? "default" : "primary"} onClick={toggleMute} aria-pressed={muted} aria-label={muted ? t("helpUnmute") : t("helpMute")}>
              {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </IconButton>
          </Tooltip>
          <Button startIcon={<ReplayIcon />} onClick={replay} disabled={muted}>
            {t("helpReplay")}
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={closeDialog}>
            {t("helpClose")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
