import { Turnstile } from "@marsidev/react-turnstile";
import { Box } from "@mui/material";
import { useEffect } from "react";

const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();

export function hasTurnstileSiteKey(): boolean {
  return Boolean(siteKey);
}

type Props = {
  /** Latest widget token, or null if disabled / expired / error */
  onTokenChange: (token: string | null) => void;
};

/** Renders Cloudflare Turnstile when `VITE_TURNSTILE_SITE_KEY` is set; otherwise notifies parent with null. */
export default function PublicTurnstileField({ onTokenChange }: Props) {
  useEffect(() => {
    if (!siteKey) onTokenChange(null);
  }, [onTokenChange]);

  if (!siteKey) return null;

  return (
    <Box sx={{ display: "flex", justifyContent: "center", my: 1.5 }}>
      <Turnstile
        siteKey={siteKey}
        onSuccess={(t) => onTokenChange(t)}
        onExpire={() => onTokenChange(null)}
        onError={() => onTokenChange(null)}
      />
    </Box>
  );
}
