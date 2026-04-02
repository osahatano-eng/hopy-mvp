// /app/api/chat/_lib/state/router.ts
export type Lang = "ja" | "en";
export type Tone5 = "anxious" | "angry" | "sad" | "neutral" | "positive";

export function detectLang(text: string): Lang {
  const s = String(text ?? "");
  const hasJa = /[ぁ-んァ-ン一-龠]/.test(s);
  return hasJa ? "ja" : "en";
}

function countHits(s: string, words: string[]) {
  let n = 0;
  for (const w of words) if (s.includes(w)) n++;
  return n;
}

export function routeInput(text: string): { lang: Lang; tone: Tone5; intensity: 1 | 2 | 3 | 4 | 5 } {
  const raw = String(text ?? "");
  const s = raw.toLowerCase();

  const lang = detectLang(raw);

  // 記号強度（雑でOK）
  const ex = (raw.match(/!/g) ?? []).length;
  const q = (raw.match(/\?/g) ?? []).length;
  const dots = (raw.match(/[。.…]/g) ?? []).length;

  // tone辞書（最小）
  const anxiousWords = lang === "ja"
    ? ["不安", "こわい", "怖い", "心配", "無理", "詰んだ", "焦る", "やばい"]
    : ["anxious", "afraid", "scared", "worried", "panic", "overwhelmed"];
  const angryWords = lang === "ja"
    ? ["ムカつく", "腹立つ", "怒", "最悪", "ふざけ", "許せない"]
    : ["angry", "mad", "furious", "pissed", "hate", "unfair"];
  const sadWords = lang === "ja"
    ? ["つらい", "辛い", "悲しい", "しんどい", "虚しい", "孤独", "泣"]
    : ["sad", "depressed", "lonely", "miserable", "cry"];
  const positiveWords = lang === "ja"
    ? ["嬉しい", "よかった", "最高", "できた", "進んだ", "ありがとう", "楽しい"]
    : ["happy", "great", "good", "thanks", "excited", "progress"];

  const a = countHits(raw, anxiousWords);
  const g = countHits(raw, angryWords);
  const d = countHits(raw, sadWords);
  const p = countHits(raw, positiveWords);

  // tone決定（最大スコア）
  let tone: Tone5 = "neutral";
  const max = Math.max(a, g, d, p);
  if (max === 0) tone = "neutral";
  else if (max === a) tone = "anxious";
  else if (max === g) tone = "angry";
  else if (max === d) tone = "sad";
  else tone = "positive";

  // intensity（1〜5）
  let intensityScore = 1;
  intensityScore += Math.min(2, ex);          // ! は強度
  intensityScore += Math.min(1, q);           // ? は少し
  intensityScore += Math.min(1, dots >= 3 ? 1 : 0); // 余韻系
  intensityScore += Math.min(2, max);         // 語彙ヒット

  const intensity = (Math.max(1, Math.min(5, intensityScore)) as 1 | 2 | 3 | 4 | 5);
  return { lang, tone, intensity };
}
