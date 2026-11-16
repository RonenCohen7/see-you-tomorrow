import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { Box, IconButton, TextField, type TextFieldProps } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type PasswordTextFieldProps = Omit<TextFieldProps, "type">;

/** Password field with a show/hide toggle for login, reset, and registration. */
export default function PasswordTextField({
  sx,
  margin,
  fullWidth,
  InputLabelProps,
  ...rest
}: PasswordTextFieldProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const isRtl = theme.direction === "rtl";
  // Keep the eye on the side opposite the floating label (label is on the right in RTL).
  const iconSide = isRtl ? "left" : "right";

  return (
    <Box
      sx={{
        position: "relative",
        width: fullWidth ? "100%" : undefined,
        ...(margin === "normal" ? { mt: 2, mb: 1 } : margin === "dense" ? { mt: 1, mb: 0.5 } : null),
      }}
    >
      <TextField
        {...rest}
        fullWidth={fullWidth}
        margin="none"
        type={visible ? "text" : "password"}
        InputLabelProps={{
          ...InputLabelProps,
          sx: [
            { maxWidth: "calc(100% - 52px)" },
            ...(InputLabelProps?.sx
              ? Array.isArray(InputLabelProps.sx)
                ? InputLabelProps.sx
                : [InputLabelProps.sx]
              : []),
          ],
        }}
        sx={[
          {
            width: "100%",
            "& .MuiOutlinedInput-input": {
              [`padding${iconSide === "left" ? "Left" : "Right"}`]: 5,
            },
          },
          ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
        ]}
      />
      <IconButton
        aria-label={visible ? t("passwordHide") : t("passwordShow")}
        onClick={() => setVisible((v) => !v)}
        onMouseDown={(e) => e.preventDefault()}
        size="small"
        tabIndex={-1}
        sx={{
          position: "absolute",
          // Align to the outlined input (56px), not the whole field (helper text sits below).
          top: 11,
          [iconSide]: 8,
          zIndex: 1,
        }}
      >
        {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
      </IconButton>
    </Box>
  );
}
