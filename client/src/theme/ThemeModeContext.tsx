import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Mode = "light" | "dark";

type Ctx = { mode: Mode; toggle: () => void };

const ThemeModeCtx = createContext<Ctx | null>(null);

const KEY = "syt_theme";

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem(KEY) as Mode) || "light");

  const toggle = useCallback(() => {
    setMode((m) => {
      const n = m === "light" ? "dark" : "light";
      localStorage.setItem(KEY, n);
      return n;
    });
  }, []);

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return <ThemeModeCtx.Provider value={value}>{children}</ThemeModeCtx.Provider>;
}

export function useThemeMode() {
  const x = useContext(ThemeModeCtx);
  if (!x) throw new Error("ThemeModeProvider");
  return x;
}
