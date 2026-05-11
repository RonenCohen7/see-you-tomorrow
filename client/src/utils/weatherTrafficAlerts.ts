import type { TFunction } from "i18next";
import CloudIcon from "@mui/icons-material/Cloud";
import TrafficIcon from "@mui/icons-material/Traffic";
import type { SmartAlert } from "./aiSmartAlerts";

const TLV_LAT = 32.0853;
const TLV_LON = 34.7818;

function isRainyCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code === 95 || code === 96 || code === 99;
}

/** Open-Meteo — no API key; CORS allowed for browser. */
export async function fetchWeatherSmartAlerts(todayIso: string, t: TFunction): Promise<SmartAlert[]> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(TLV_LAT));
    url.searchParams.set("longitude", String(TLV_LON));
    url.searchParams.set("daily", "weathercode,precipitation_probability_max");
    url.searchParams.set("timezone", "Asia/Jerusalem");
    url.searchParams.set("forecast_days", "5");
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = (await res.json()) as {
      daily?: { time?: string[]; weathercode?: number[]; precipitation_probability_max?: number[] };
    };
    const times = data.daily?.time ?? [];
    const codes = data.daily?.weathercode ?? [];
    const probs = data.daily?.precipitation_probability_max ?? [];
    const out: SmartAlert[] = [];
    for (let i = 0; i < times.length; i++) {
      const date = times[i];
      const code = codes[i] ?? 0;
      const prob = probs[i] ?? 0;
      if (!date || date < todayIso) continue;
      if (isRainyCode(code) || prob >= 55) {
        out.push({
          id: `weather-${date}`,
          severity: prob >= 70 || isRainyCode(code) ? "warning" : "info",
          employeeId: "system",
          employeeName: t("aiWeatherContextLabel"),
          title: t("aiWeatherAlertTitle", { date }),
          detail: t("aiWeatherAlertDetail", { prob, code }),
          Icon: CloudIcon,
          color: "#0284c7",
        });
        break;
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Static awareness — real-time traffic feeds can be wired later (Waze / municipal APIs). */
export function buildTrafficAwarenessAlert(t: TFunction): SmartAlert {
  return {
    id: "traffic-awareness",
    severity: "info",
    employeeId: "system",
    employeeName: t("aiTrafficContextLabel"),
    title: t("aiTrafficAlertTitle"),
    detail: t("aiTrafficAlertDetail"),
    Icon: TrafficIcon,
    color: "#b45309",
  };
}
