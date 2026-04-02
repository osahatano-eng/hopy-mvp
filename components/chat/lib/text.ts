import type { Lang } from "./chatTypes";

export function hasJapanese(s: string) {
  return /[ぁ-んァ-ン一-龠]/.test(s);
}

export function englishLetterRatio(s: string) {
  const letters = (s.match(/[A-Za-z]/g) ?? []).length;
  const nonSpace = s.replace(/\s/g, "").length || 1;
  return letters / nonSpace;
}

export function detectUserLang(text: string): Lang {
  const t = String(text ?? "").trim();
  if (!t) return "ja";
  if (hasJapanese(t)) return "ja";
  if (englishLetterRatio(t) >= 0.18) return "en";
  return "ja";
}

export function clampText(s: string, max = 8000) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) : t;
}
