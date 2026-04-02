// /app/api/chat/_lib/state/strategy.ts
import type { Tone5 } from "./router";

export type Strategy4 = "grounding" | "reflect" | "reframe" | "one_step";

export function pickStrategy(tone: Tone5, intensity: number): Strategy4 {
  const strong = intensity >= 4;

  if (tone === "anxious" && strong) return "grounding";
  if (tone === "angry" && strong) return "reflect";
  if (tone === "sad" && strong) return "reflect"; // one_stepは後段で
  if (tone === "neutral") return Math.random() < 0.5 ? "reframe" : "one_step";
  if (tone === "positive") return "one_step";

  // 弱めのとき
  if (tone === "anxious") return "reflect";
  if (tone === "angry") return "reflect";
  if (tone === "sad") return "reflect";
  return "one_step";
}

export function rotateStyleId(prevStyleId: number | null): 1 | 2 | 3 {
  const base = prevStyleId && [1, 2, 3].includes(prevStyleId) ? prevStyleId : 0;
  const next = ((base % 3) + 1) as 1 | 2 | 3;
  return next;
}
