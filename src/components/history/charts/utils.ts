import type { TrendDir } from "./types";

export function fmtWeek(label: string): string {
  const parts = label.split("-");
  return parts.length >= 2 ? parts[parts.length - 1] : label;
}

export function fmtMonth(label: string): string {
  const [year, month] = label.split("-");
  if (!year || !month) return label;
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString("default", { month: "short" });
}

export function trendDir(values: number[]): TrendDir {
  if (values.length < 2) return "flat";
  const delta = values[values.length - 1] - values[0];
  if (delta > 2) return "up";
  if (delta < -2) return "down";
  return "flat";
}

/** Shared recharts axis tick style */
export const TICK_STYLE = { fontSize: 10, fill: "rgba(128,128,128,0.8)" } as const;

/** Shared recharts grid stroke */
export const GRID_STROKE = "rgba(128,128,128,0.12)";
