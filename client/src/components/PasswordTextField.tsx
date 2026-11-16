import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { IconButton, InputAdornment, TextField, type TextFieldProps } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type PasswordTextFieldProps = Omit<TextFieldProps, "type">;

/** Password field with a show/hide toggle for login, reset, and registration. */
export default function PasswordTextField(props: PasswordTextFieldProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      InputProps={{
        ...props.InputProps,
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={visible ? t("passwordHide") : t("passwordShow")}
              onClick={() => setVisible((v) => !v)}
              onMouseDown={(e) => e.preventDefault()}
              edge="end"
              size="small"
            >
              {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
            </IconButton>
          </InputAdornment>
        ),
      }}
    />
  );
}
