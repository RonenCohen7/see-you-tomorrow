import type { ChipProps } from "@mui/material/Chip";
import type { Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import type { AlertColor } from "@mui/material";

/** עיצוב אחיד ל-Alerts במסלול העדפות→AI לפי מצב הטיפול. */
export function pipelineAlertPresentation(
  status: string | null | undefined,
  theme: Theme
): {
  severity: AlertColor;
  sx: Record<string, unknown>;
  chipTranslationKey?: string;
  chipColor?: ChipProps["color"];
} {
  switch (status) {
    case "applied":
      return {
        severity: "success",
        chipTranslationKey: "prefPipelineChipApplied",
        chipColor: "success",
        sx: {
          borderLeftWidth: 4,
          borderLeftStyle: "solid",
          borderLeftColor: theme.palette.success.dark,
          bgcolor: alpha(theme.palette.success.main, 0.09),
        },
      };
    case "awaiting_manager":
      return {
        severity: "info",
        chipTranslationKey: "prefPipelineChipAwaitingManager",
        chipColor: "primary",
        sx: {
          borderLeftWidth: 4,
          borderLeftStyle: "solid",
          borderLeftColor: theme.palette.primary.main,
          bgcolor: alpha(theme.palette.primary.main, 0.08),
        },
      };
    case "ai_failed":
      return {
        severity: "warning",
        chipTranslationKey: "prefPipelineChipAiHandledFailed",
        chipColor: "warning",
        sx: {
          borderLeftWidth: 4,
          borderLeftStyle: "solid",
          borderLeftColor: theme.palette.warning.dark,
          bgcolor: alpha(theme.palette.warning.main, 0.12),
        },
      };
    case "rejected":
      return {
        severity: "warning",
        chipTranslationKey: "prefPipelineChipRejectedHandled",
        chipColor: "warning",
        sx: {
          borderLeftWidth: 4,
          borderLeftStyle: "solid",
          borderLeftColor: theme.palette.warning.dark,
          bgcolor: alpha(theme.palette.warning.main, 0.12),
        },
      };
    case "queued":
      return {
        severity: "info",
        chipTranslationKey: "prefPipelineChipQueued",
        chipColor: "info",
        sx: {
          borderLeftWidth: 4,
          borderLeftStyle: "solid",
          borderLeftColor: theme.palette.info.main,
          bgcolor: alpha(theme.palette.info.main, 0.08),
        },
      };
    case "ai_running":
      return {
        severity: "info",
        chipTranslationKey: "prefPipelineChipAiRunning",
        chipColor: "info",
        sx: {
          borderLeftWidth: 4,
          borderLeftStyle: "solid",
          borderLeftColor: theme.palette.info.main,
          bgcolor: alpha(theme.palette.info.main, 0.08),
        },
      };
    case "superseded":
      return {
        severity: "info",
        chipTranslationKey: "prefPipelineChipSuperseded",
        chipColor: "default",
        sx: {
          borderLeftWidth: 4,
          borderLeftStyle: "solid",
          borderLeftColor: theme.palette.divider,
          bgcolor: alpha(theme.palette.text.primary, 0.04),
        },
      };
    default:
      return {
        severity: "info",
        sx: {},
      };
  }
}
