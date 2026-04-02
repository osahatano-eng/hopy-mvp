import type { Lang } from "./chatTypes";

export function toLocalDateKey(iso?: string) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateLabel(iso?: string, uiLang: Lang = "ja") {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const wd = d.toLocaleDateString(uiLang === "en" ? "en-US" : "ja-JP", {
    weekday: "short",
  });
  return uiLang === "en" ? `${m}/${day}/${y} · ${wd}` : `${y}/${m}/${day}（${wd}）`;
}
