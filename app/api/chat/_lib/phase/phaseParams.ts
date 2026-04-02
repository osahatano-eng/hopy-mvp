// /app/api/chat/_lib/phase/phaseParams.ts
import { clampInt, envInt } from "../env";

type PhaseParams = {
  temperature: number;
  max_tokens: number;
};

function clampFloat(x: any, fallback: number, min: number, max: number) {
  const n = Number(x);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Phaseごとの生成パラメータ（1..5固定）
 * 1: 混線   -> 最も安定寄り
 * 2: 模索   -> やや広げる
 * 3: 整理   -> バランス
 * 4: 収束   -> やや絞る
 * 5: 決定   -> 最も明確・簡潔寄り
 *
 * env未設定時も安定側に倒す。
 */
export function phaseParams(phase: number): PhaseParams {
  const normalizedPhase = clampInt(Math.round(Number(phase) || 1), 1, 5);

  // temperature
  const p1Temp = clampFloat(process.env.HOPY_PHASE1_TEMP, 0.30, 0.0, 0.70);
  const p2Temp = clampFloat(process.env.HOPY_PHASE2_TEMP, 0.42, 0.0, 0.80);
  const p3Temp = clampFloat(process.env.HOPY_PHASE3_TEMP, 0.52, 0.0, 0.85);
  const p4Temp = clampFloat(process.env.HOPY_PHASE4_TEMP, 0.40, 0.0, 0.80);
  const p5Temp = clampFloat(process.env.HOPY_PHASE5_TEMP, 0.28, 0.0, 0.70);

  // max_tokens
  const TOKENS_MAX_HARD = clampInt(envInt("HOPY_MAX_TOKENS_HARD", 1200), 200, 2200);

  const p1Tok = clampInt(envInt("HOPY_PHASE1_MAX_TOKENS", 420), 80, TOKENS_MAX_HARD);
  const p2Tok = clampInt(envInt("HOPY_PHASE2_MAX_TOKENS", 560), 120, TOKENS_MAX_HARD);
  const p3Tok = clampInt(envInt("HOPY_PHASE3_MAX_TOKENS", 680), 160, TOKENS_MAX_HARD);
  const p4Tok = clampInt(envInt("HOPY_PHASE4_MAX_TOKENS", 560), 120, TOKENS_MAX_HARD);
  const p5Tok = clampInt(envInt("HOPY_PHASE5_MAX_TOKENS", 420), 80, TOKENS_MAX_HARD);

  if (normalizedPhase === 1) return { temperature: p1Temp, max_tokens: p1Tok };
  if (normalizedPhase === 2) return { temperature: p2Temp, max_tokens: p2Tok };
  if (normalizedPhase === 3) return { temperature: p3Temp, max_tokens: p3Tok };
  if (normalizedPhase === 4) return { temperature: p4Temp, max_tokens: p4Tok };
  return { temperature: p5Temp, max_tokens: p5Tok };
}