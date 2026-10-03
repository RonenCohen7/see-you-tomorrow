import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "syt-local-flag-change";

export const MANAGER_GAP_HINTS_HIDDEN_KEY = "syt.hideManagerGapHints";
export const FLOATING_BUTTONS_HIDDEN_KEY = "syt.hideFloatingButtons";

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Boolean UI preference persisted per browser; all hooks with the same key stay in sync. */
export function useLocalStorageFlag(key: string): [boolean, (value: boolean) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const handler = (e: Event) => {
        if (e instanceof StorageEvent ? e.key === key : (e as CustomEvent<string>).detail === key) onChange();
      };
      window.addEventListener("storage", handler);
      window.addEventListener(CHANGE_EVENT, handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(CHANGE_EVENT, handler);
      };
    },
    [key]
  );
  const value = useSyncExternalStore(subscribe, () => read(key), () => false);
  const setValue = useCallback(
    (next: boolean) => {
      try {
        if (next) window.localStorage.setItem(key, "1");
        else window.localStorage.removeItem(key);
      } catch {
        /* storage unavailable (e.g. private mode) */
      }
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
    },
    [key]
  );
  return [value, setValue];
}
