import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ReplayIcon from "@mui/icons-material/Replay";
import VolumeOffIcon from "@mui/icons-material/VolumeOff";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import {
  Box,
  GlobalStyles,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  Button,
  alpha,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { getHelpSegments, helpHighlightSelector, helpScreenTitleKey } from "../help/screenHelpScripts";
import { useLocale } from "../locale/LocaleContext";
import {
  normalizeTextForTts,
  pickVoiceForLocale,
  utteranceLangForVoice,
} from "../utils/helpScreenTts";

export { normalizeTextForTts } from "../utils/helpScreenTts";

const AVATAR_SRC = "/help-avatar.png";

const VOICE_POLL_MAX = 12;
const VOICE_POLL_MS = 100;

const SPOTLIGHT_PAD = 8;

export type ScreenHelpOverlayProps = {
  open: boolean;
  onClose: () => void;
};

type RectLite = Pick<DOMRect, "top" | "left" | "right" | "bottom" | "width" | "height">;

function useRectForHighlight(token: string | undefined, deps: unknown[]) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const selector = token ? helpHighlightSelector(token) : null;
    if (!selector || typeof document === "undefined") {
      setRect(null);
      return;
    }

    const read = () => {
      try {
        const el = document.querySelector(selector);
        if (!el) {
          setRect(null);
          return;
        }
        const r = el.getBoundingClientRect();
        setRect(r.width > 4 && r.height > 4 ? r : null);
      } catch {
        setRect(null);
      }
    };

    read();
    const bump = () => read();
    window.addEventListener("resize", bump);
    window.addEventListener("scroll", bump, true);
    return () => {
      window.removeEventListener("resize", bump);
      window.removeEventListener("scroll", bump, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return rect;
}

function DimPanels({ rect, zIndex, dim }: { rect: RectLite | null; zIndex: number; dim: string }) {
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  if (!rect || vw <= 0 || vh <= 0) {
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          bgcolor: dim,
          zIndex,
          pointerEvents: "auto",
        }}
      />
    );
  }

  const pad = SPOTLIGHT_PAD;
  const t = Math.max(0, rect.top - pad);
  const l = Math.max(0, rect.left - pad);
  const r = Math.min(vw, rect.right + pad);
  const b = Math.min(vh, rect.bottom + pad);
  const panelSx = {
    position: "fixed" as const,
    bgcolor: dim,
    zIndex,
    pointerEvents: "auto" as const,
  };

  return (
    <>
      <Box sx={{ ...panelSx, top: 0, left: 0, width: vw, height: t }} />
      <Box sx={{ ...panelSx, top: b, left: 0, width: vw, height: Math.max(0, vh - b) }} />
      <Box sx={{ ...panelSx, top: t, left: 0, width: l, height: Math.max(0, b - t) }} />
      <Box sx={{ ...panelSx, top: t, left: r, width: Math.max(0, vw - r), height: Math.max(0, b - t) }} />
      <Box
        sx={{
          position: "fixed",
          left: l,
          top: t,
          width: Math.max(0, r - l),
          height: Math.max(0, b - t),
          zIndex,
          pointerEvents: "none",
          boxShadow: `0 0 0 3px ${alpha("#ffb300", 0.95)} inset`,
          borderRadius: 1,
          boxSizing: "border-box",
        }}
      />
    </>
  );
}

function HelpTourArrow({
  from,
  to,
  zIndex,
}: {
  from: { x: number; y: number } | null;
  to: { x: number; y: number } | null;
  zIndex: number;
}) {
  const uid = useId().replace(/:/g, "");
  const markerId = `syt-ha-${uid}`;

  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;

  if (!from || !to) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 28) return null;

  const mx = from.x + dx * 0.55;
  const my = from.y + dy * 0.55;

  return (
    <svg
      aria-hidden
      width={w}
      height={h}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        zIndex,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <defs>
        <marker id={markerId} markerWidth="10" markerHeight="10" refX={8} refY={3} orient="auto">
          <path d="M0,0 L10,3 L0,6 Z" fill="#ffb300" />
        </marker>
      </defs>
      <path
        d={`M ${from.x},${from.y} Q ${mx},${my} ${to.x},${to.y}`}
        fill="none"
        stroke="#ffb300"
        strokeWidth={3}
        markerEnd={`url(#${markerId})`}
      />
    </svg>
  );
}

export function ScreenHelpOverlay({ open, onClose }: ScreenHelpOverlayProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down("sm"));
  const { pathname } = useLocation();
  const { locale } = useLocale();

  const [muted, setMuted] = useState(true);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [noPreferredVoice, setNoPreferredVoice] = useState(false);
  const [layoutTick, setLayoutTick] = useState(0);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const utterGenRef = useRef(0);
  const prevOpenRef = useRef(false);

  const segments = useMemo(() => getHelpSegments(pathname, locale), [pathname, locale]);
  const screenTitleKey = useMemo(() => helpScreenTitleKey(pathname), [pathname]);

  const zDim = theme.zIndex.tooltip + 15;
  const zArrow = zDim + 1;
  const zCard = zDim + 2;

  useEffect(() => {
    setSegmentIndex(0);
    setSpeaking(false);
    window.speechSynthesis.cancel();
  }, [pathname]);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setMuted(true);
      setSegmentIndex(0);
      setRestartToken((x) => x + 1);
    }
    prevOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      utterGenRef.current += 1;
      document.documentElement.removeAttribute("data-syt-help-open");
      return undefined;
    }

    document.documentElement.setAttribute("data-syt-help-open", "");

    const prevOv = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOv;
      document.documentElement.removeAttribute("data-syt-help-open");
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const bump = () => setLayoutTick((n) => n + 1);
    window.addEventListener("resize", bump);
    return () => window.removeEventListener("resize", bump);
  }, [open]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (!open || e.key !== "Escape") return;
      utterGenRef.current += 1;
      window.speechSynthesis.cancel();
      onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const synth = window.speechSynthesis;
    const refresh = () => synth.getVoices();
    refresh();
    synth.addEventListener("voiceschanged", refresh);
    return () => synth.removeEventListener("voiceschanged", refresh);
  }, [open]);

  const currentHighlight = segments[segmentIndex]?.highlight;
  const targetRect = useRectForHighlight(currentHighlight, [open, segmentIndex, currentHighlight, layoutTick]);

  useLayoutEffect(() => {
    if (!open || !currentHighlight) return;
    const sel = helpHighlightSelector(currentHighlight);
    if (!sel) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(sel);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      setLayoutTick((n) => n + 1);
    });
  }, [open, segmentIndex, currentHighlight]);

  /** TTS: one utterance per step */
  useEffect(() => {
    window.speechSynthesis.cancel();

    if (!open || muted) {
      setSpeaking(false);
      setNoPreferredVoice(false);
      return undefined;
    }

    let cancelled = false;
    const timeouts: number[] = [];

    const flushTimeouts = () => {
      timeouts.forEach((id) => window.clearTimeout(id));
      timeouts.length = 0;
    };

    const textBody = segments[segmentIndex]?.text;
    if (!textBody) {
      setSpeaking(false);
      return undefined;
    }

    const sessionEnter = utterGenRef.current;

    const proceedSpeak = () => {
      if (cancelled || sessionEnter !== utterGenRef.current) return;

      const forSpeech = normalizeTextForTts(textBody, locale);
      const u = new SpeechSynthesisUtterance(forSpeech || textBody);
      const voice = pickVoiceForLocale(locale);
      const voicesNow = window.speechSynthesis.getVoices();
      if (voicesNow.length > 0 && !voice) setNoPreferredVoice(true);
      else setNoPreferredVoice(false);

      u.lang = utteranceLangForVoice(voice, locale);
      u.rate = 0.84;
      u.pitch = 1;
      if (voice) u.voice = voice;

      u.onstart = () => {
        if (!cancelled && utterGenRef.current === sessionEnter) setSpeaking(true);
      };
      u.onend = () => {
        if (cancelled || utterGenRef.current !== sessionEnter) return;
        setSpeaking(false);
        setSegmentIndex((i) => {
          const next = i + 1 < segments.length ? i + 1 : i;
          if (next !== i) utterGenRef.current += 1;
          return next;
        });
      };
      u.onerror = () => {
        if (cancelled || utterGenRef.current !== sessionEnter) return;
        setSpeaking(false);
      };
      window.speechSynthesis.speak(u);
    };

    window.speechSynthesis.getVoices();
    const poll = (attempt: number) => {
      if (cancelled) return;
      window.speechSynthesis.getVoices();
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0 && attempt < VOICE_POLL_MAX) {
        timeouts.push(window.setTimeout(() => poll(attempt + 1), VOICE_POLL_MS));
        return;
      }
      proceedSpeak();
    };
    poll(0);

    return () => {
      cancelled = true;
      flushTimeouts();
      window.speechSynthesis.cancel();
      setSpeaking(false);
    };
  }, [open, muted, pathname, locale, segments, segmentIndex, restartToken]);

  const bumpUtterGeneration = () => {
    utterGenRef.current += 1;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const closeTour = useCallback(() => {
    bumpUtterGeneration();
    onClose();
  }, [onClose]);

  const replay = () => {
    bumpUtterGeneration();
    setSegmentIndex(0);
    setRestartToken((x) => x + 1);
  };

  const goPrev = () => {
    bumpUtterGeneration();
    setSegmentIndex((i) => Math.max(0, i - 1));
    setRestartToken((x) => x + 1);
  };

  const goNext = () => {
    bumpUtterGeneration();
    setSegmentIndex((i) => Math.min(segments.length - 1, i + 1));
    setRestartToken((x) => x + 1);
  };

  const dimColor = alpha("#000000", theme.palette.mode === "dark" ? 0.65 : 0.5);

  const caption = segments[segmentIndex]?.text ?? "";
  const lastIdx = Math.max(0, segments.length - 1);

  const [arrowEnds, setArrowEnds] = useState<{
    from: { x: number; y: number } | null;
    to: { x: number; y: number } | null;
  }>({ from: null, to: null });

  useLayoutEffect(() => {
    if (!open) {
      setArrowEnds({ from: null, to: null });
      return;
    }

    requestAnimationFrame(() => {
      const card = cardRef.current?.getBoundingClientRect();
      const tr = targetRect;
      if (!card || card.width < 36) {
        setArrowEnds({ from: null, to: null });
        return;
      }

      const cx = card.left + card.width / 2;
      let fy = card.top + 14;
      if (tr && tr.top > card.bottom - 28) fy = Math.min(card.bottom + 10, typeof window !== "undefined" ? window.innerHeight - 12 : fy);

      const from = { x: cx, y: fy };

      let toP: { x: number; y: number } | null = null;
      if (tr && tr.width > 8 && tr.height > 8) {
        toP = {
          x: Math.min(Math.max(tr.left + tr.width / 2, tr.left + 16), tr.right - 16),
          y: Math.min(Math.max(tr.top + tr.height / 2, tr.top + 12), tr.bottom - 12),
        };
      }

      setArrowEnds({ from, to: toP });
    });
  }, [open, caption, targetRect, layoutTick, segmentIndex]);

  if (!open) return null;

  const portalContent = (
    <>
      <GlobalStyles
        styles={{
          "@keyframes sytHelpTalk": {
            "0%, 100%": { transform: "scale(1)", filter: "brightness(1)" },
            "50%": { transform: "scale(1.035)", filter: "brightness(1.06)" },
          },
        }}
      />

      <DimPanels rect={targetRect} zIndex={zDim} dim={dimColor} />

      <HelpTourArrow zIndex={zArrow} from={arrowEnds.from} to={arrowEnds.to} />

      <Paper
        elevation={14}
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="syt-help-dialog-title"
        sx={{
          position: "fixed",
          ...(isXs
            ? {
                left: "50%",
                right: "auto",
                transform: "translateX(-50%)",
              }
            : {
                left: "auto",
                right: 24,
                transform: "none",
              }),
          bottom: `max(20px, env(safe-area-inset-bottom, 0px))`,
          maxWidth: { xs: "calc(100vw - 24px)", sm: 520 },
          width: "100%",
          zIndex: zCard,
          px: { xs: 1.75, sm: 2.25 },
          py: { xs: 2, sm: 2 },
          pb: { xs: 2, sm: 2.25 },
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
          pointerEvents: "auto",
          boxSizing: "border-box",
        }}
      >
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography id="syt-help-dialog-title" component="span" variant="subtitle1" fontWeight={900}>
                {t("helpDialogTitle")}
                {screenTitleKey ? (
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block", fontWeight: 600, mt: 0.35 }}>
                    — {t(screenTitleKey)}
                  </Typography>
                ) : null}
              </Typography>
              <Typography variant="caption" color="primary" fontWeight={800} sx={{ display: "block", mt: 0.75 }}>
                {t("helpStepProgress", {
                  current: segmentIndex + 1,
                  total: segments.length || 1,
                })}
              </Typography>
            </Box>
            <IconButton edge="end" size="small" onClick={closeTour} aria-label={t("helpClose")} sx={{ flexShrink: 0 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "center", sm: "flex-start" }}>
            <Box
              sx={{
                flexShrink: 0,
                width: { xs: 120, sm: 132 },
                borderRadius: 2,
                overflow: "hidden",
                border: "2px solid",
                borderColor: "divider",
                boxShadow: 1,
                animation: speaking && !muted ? "sytHelpTalk 0.9s ease-in-out infinite" : "none",
              }}
            >
              <Box component="img" src={AVATAR_SRC} alt="" sx={{ width: "100%", height: "auto", display: "block" }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
              <Typography variant="body1" sx={{ lineHeight: 1.65, whiteSpace: "pre-wrap", fontWeight: 600 }} aria-live="polite">
                {caption || "\u00a0"}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25, lineHeight: 1.5 }}>
                {t("helpTtsHint")}
              </Typography>
              {noPreferredVoice && !muted ? (
                <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.75, lineHeight: 1.45 }}>
                  {t("helpTtsMissingVoice")}
                </Typography>
              ) : null}
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
            <Tooltip title={muted ? t("helpUnmute") : t("helpMute")} arrow>
              <IconButton
                color={muted ? "default" : "primary"}
                onClick={() => {
                  utterGenRef.current += 1;
                  window.speechSynthesis.cancel();
                  setMuted((m) => !m);
                  setRestartToken((x) => x + 1);
                }}
                aria-pressed={muted}
                aria-label={muted ? t("helpUnmute") : t("helpMute")}
              >
                {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
              </IconButton>
            </Tooltip>
            <Button startIcon={<ReplayIcon />} onClick={replay} size="small" variant="outlined">
              {t("helpReplay")}
            </Button>

            <Box sx={{ flex: 1 }} />

            <IconButton aria-label={t("helpPrev")} onClick={goPrev} disabled={segmentIndex <= 0} size="medium">
              {theme.direction === "rtl" ? <ArrowForwardIcon /> : <ArrowBackIcon />}
            </IconButton>
            <IconButton aria-label={t("helpNext")} onClick={goNext} disabled={segmentIndex >= lastIdx} size="medium">
              {theme.direction === "rtl" ? <ArrowBackIcon /> : <ArrowForwardIcon />}
            </IconButton>
            <Button variant="contained" onClick={closeTour}>
              {t("helpClose")}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </>
  );

  return createPortal(portalContent, document.body);
}
