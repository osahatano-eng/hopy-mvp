// /components/chat/lib/chatAppMessageUtils.ts

export type ChatAppLang = "en" | "ja";

export function hasJapanese(s: string) {
  return /[ぁ-んァ-ン一-龠]/.test(s);
}

export function englishLetterRatio(s: string) {
  const letters = (s.match(/[A-Za-z]/g) ?? []).length;
  const nonSpace = s.replace(/\s/g, "").length || 1;
  return letters / nonSpace;
}

export function detectUserLang(text: string): ChatAppLang {
  const t = String(text ?? "").trim();
  if (!t) return "ja";
  if (hasJapanese(t)) return "ja";
  if (englishLetterRatio(t) >= 0.18) return "en";
  return "ja";
}

export function toLocalDateKey(iso?: string) {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDateLabel(iso?: string, uiLang: ChatAppLang = "ja") {
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