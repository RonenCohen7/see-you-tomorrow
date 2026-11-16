import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { IconButton, InputAdornment, TextField, type TextFieldProps } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type PasswordTextFieldProps = Omit<TextFieldProps, "type">;

/**
 * Password field with a show/hide toggle.
 * The label stays shrunk on the outline notch so it never overlaps the eye in RTL or LTR.
 */
export default function PasswordTextField({ InputLabelProps, InputProps, ...rest }: PasswordTextFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...rest}
      type={visible ? "text" : "password"}
      InputLabelProps={{
        ...InputLabelProps,
        shrink: true,
      }}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={visible ? t("passwordHide") : t("passwordShow")}
              onClick={() => setVisible((v) => !v)}
              onMouseDown={(e) => e.preventDefault()}
              edge="end"
              size="small"
              tabIndex={-1}
            >
              {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}
