// /app/api/chat/_lib/router/simpleRouter.ts

// ✅ Lang は single source of truth: /_lib/text.ts
import type { Lang } from "../text";
export type { Lang };

export type Tone5 = "anxious" | "angry" | "sad" | "neutral" | "positive";
export type Strategy4 = "grounding" | "reflect" | "reframe" | "one_step";

/* =========================
 * ✅ 定数は外出し（毎回生成しない）
 * ========================= */

const ANXIOUS_JA = ["不安", "こわい", "怖い", "心配", "無理", "詰んだ", "焦る", "やばい"];
const ANGRY_JA = ["ムカつく", "腹立つ", "怒", "最悪", "ふざけ", "許せない"];
const SAD_JA = ["つらい", "辛い", "悲しい", "しんどい", "虚しい", "孤独", "泣"];
const POSITIVE_JA = ["嬉しい", "よかった", "最高", "できた", "進んだ", "ありがとう", "楽しい"];

const ANXIOUS_EN = ["anxious", "afraid", "scared", "worried", "panic", "overwhelmed"];
const ANGRY_EN = ["angry", "mad", "furious", "pissed", "hate", "unfair"];
const SAD_EN = ["sad", "depressed", "lonely", "miserable", "cry"];
const POSITIVE_EN = ["happy", "great", "good", "thanks", "excited", "progress"];

/* ========================= */

function detectLang(text: string): Lang {
  return /[ぁ-んァ-ン一-龠]/.test(String(text ?? "")) ? "ja" : "en";
}

function countHits(s: string, words: readonly string[]) {
  let n = 0;
  for (const w of words) if (s.includes(w)) n++;
  return n;
}

function clamp5(n: number): 1 | 2 | 3 | 4 | 5 {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  return 5;
}

/* =========================
 * 🎯 ルーティング（完全 deterministic）
 * ========================= */

export function routeInput(text: string): {
  lang: Lang;
  tone: Tone5;
  intensity: 1 | 2 | 3 | 4 | 5;
} {
  const raw = String(text ?? "");
  const lang = detectLang(raw);

  const ex = (raw.match(/!/g) ?? []).length;
  const q = (raw.match(/\?/g) ?? []).length;
  const dots = (raw.match(/[。.…]/g) ?? []).length;

  const anxiousWords = lang === "ja" ? ANXIOUS_JA : ANXIOUS_EN;
  const angryWords = lang === "ja" ? ANGRY_JA : ANGRY_EN;
  const sadWords = lang === "ja" ? SAD_JA : SAD_EN;
  const positiveWords = lang === "ja" ? POSITIVE_JA : POSITIVE_EN;

  const a = countHits(raw, anxiousWords);
  const g = countHits(raw, angryWords);
  const d = countHits(raw, sadWords);
  const p = countHits(raw, positiveWords);

  let tone: Tone5 = "neutral";
  const max = Math.max(a, g, d, p);

  if (max > 0) {
    if (max === a) tone = "anxious";
    else if (max === g) tone = "angry";
    else if (max === d) tone = "sad";
    else tone = "positive";
  }

  let intensityScore = 1;
  intensityScore += Math.min(2, ex);
  intensityScore += Math.min(1, q);
  if (dots >= 3) intensityScore += 1;
  intensityScore += Math.min(2, max);

  const intensity = clamp5(intensityScore);

  return { lang, tone, intensity };
}

/* =========================
 * 🎯 Strategy（完全 deterministic）
 * ========================= */

export function pickStrategy(tone: Tone5, intensity: number): Strategy4 {
  const strong = intensity >= 4;

  if (tone === "anxious" && strong) return "grounding";
  if (tone === "angry" && strong) return "reflect";
  if (tone === "sad" && strong) return "reflect";

  if (tone === "positive") return "one_step";

  // ✅ neutral は常に one_step（ランダム排除）
  if (tone === "neutral") return "one_step";

  // 弱いネガティブ
  if (tone === "anxious") return "reflect";
  if (tone === "angry") return "reflect";
  if (tone === "sad") return "reflect";

  return "one_step";
}

/* ========================= */

export function rotateStyleId(prevStyleId: number | null): 1 | 2 | 3 {
  const base = prevStyleId && prevStyleId >= 1 && prevStyleId <= 3 ? prevStyleId : 0;
  return ((base % 3) + 1) as 1 | 2 | 3;
}

function headPhrase(s: string): string {
  const t = String(s ?? "").trim();
  if (!t) return "";
  const firstLine = t.split("\n")[0] ?? "";
  return firstLine.trim().slice(0, 20);
}

export function buildAvoidList(outputs: string[], max = 6): string[] {
  const list: string[] = [];

  for (const o of outputs) {
    const h = headPhrase(o);
    if (h && !list.includes(h)) list.push(h);
  }

  // 上限を6に固定（route.tsと一致）
  return list.slice(0, Math.min(6, Math.max(0, max)));
}