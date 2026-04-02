// /app/api/chat/_lib/state/score.ts
import type { Lang } from "../text";
import { clampInt, envInt } from "../env";

/**
 * ---- build signature (for observability) ----
 * last_trigger.reasons に必ず入れて「反映されているか」を切り分ける
 */
const SCORE_SIG = "score_sig_2026-02-19_a16_1";

function envIntSigned(name: string, fallback: number) {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v)) return fallback;
  return Math.trunc(v);
}

/**
 * ---- knobs (stability-first) ----
 */
const DELTA_MIN = envIntSigned("USER_STATE_DELTA_MIN", -8);
const DELTA_MAX = envIntSigned("USER_STATE_DELTA_MAX", 8);

/**
 * HOPY 5段階
 * 1: 混線
 * 2: 模索
 * 3: 整理
 * 4: 収束
 * 5: 決定
 *
 * stability_score は -100..100 で運用されるため、
 * phase 5 の入口を 101 以上に置くと通常経路では到達不能になる。
 *
 * そのため既定帯域は次に固定する:
 * <= -35       => 1
 * -34 .. -6    => 2
 * -5  .. 24    => 3
 * 25  .. 99    => 4
 * >= 100       => 5
 *
 * ※ 5 は「決定」であり、十分に整って手仕舞いできる状態を表す。
 * ※ 必要なら env で上書き可能。
 */
const PHASE1_MAX = envIntSigned("USER_STATE_PHASE1_MAX", -35);
const PHASE2_MAX = envIntSigned("USER_STATE_PHASE2_MAX", -6);
const PHASE3_MAX = envIntSigned("USER_STATE_PHASE3_MAX", 24);
const PHASE4_MAX = envIntSigned("USER_STATE_PHASE4_MAX", 99);

/**
 * Phase2-①: anti-misfire guards
 */
const PER_MESSAGE_ABS_MAX = envInt("USER_STATE_PER_MESSAGE_ABS_MAX", 3);

const COOLDOWN_COMPRESS_FACTOR_X100 = envInt(
  "USER_STATE_COOLDOWN_COMPRESS_FACTOR_X100",
  40
);
void COOLDOWN_COMPRESS_FACTOR_X100;

const PHASE_HYSTERESIS = envInt("USER_STATE_PHASE_HYSTERESIS", 3);

/**
 * Phase1 UX: first negative should still "move" a little (feel effective),
 * but keep streak compression for repeated negatives.
 *
 * - If a negative delta exists and it's the first in a streak, apply -1 minimum.
 * - Does NOT override explicit self-harm handling (explicit stays as before).
 * - Per-message clip still applies.
 */
const NEG_FIRST_MIN_APPLY = envInt("USER_STATE_NEG_FIRST_MIN_APPLY", 1);

function clampDelta(d: number) {
  return clampInt(d, DELTA_MIN, DELTA_MAX);
}

function clampPerMessage(d: number) {
  return clampInt(d, -PER_MESSAGE_ABS_MAX, PER_MESSAGE_ABS_MAX);
}

export function shouldSkipStateUpdateByCooldown(
  updatedAt: string | null | undefined,
  minIntervalSec: number
) {
  if (!updatedAt) return false;
  const t = new Date(updatedAt).getTime();
  if (!Number.isFinite(t)) return false;
  const diffSec = Math.floor((Date.now() - t) / 1000);
  return diffSec >= 0 && diffSec < minIntervalSec;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hitWordsEn(sLower: string, words: string[]) {
  for (const w of words) {
    const ww = String(w ?? "").toLowerCase().trim();
    if (!ww) continue;
    const re = new RegExp(
      `(^|[^a-z0-9_])${escapeRegExp(ww)}([^a-z0-9_]|$)`,
      "i"
    );
    if (re.test(sLower)) return true;
  }
  return false;
}

function hitIncludes(sLower: string, keys: string[]) {
  return keys.some((k) => {
    const kk = String(k ?? "").toLowerCase();
    return kk ? sLower.includes(kk) : false;
  });
}

function isExplicitSelfHarm(textLower: string, uiLang: Lang) {
  if (uiLang === "ja") {
    return (
      hitIncludes(textLower, ["死にたい"]) ||
      hitIncludes(textLower, ["消えたい"])
    );
  }
  return (
    hitWordsEn(textLower, ["suicide"]) ||
    hitWordsEn(textLower, ["kill myself"]) ||
    hitWordsEn(textLower, ["want to die"])
  );
}

export function detectTrigger(text: string, uiLang: Lang): string | null {
  const sLower = String(text ?? "").toLowerCase();

  const ja = {
    anger: ["ふざけ", "むかつ", "最悪", "キレ", "怒", "腹立"],
    anxiety: [
      "不安",
      "こわ",
      "怖",
      "焦",
      "しんど",
      "つら",
      "辛",
      "無理",
      "迷い",
      "わからない",
      "分からない",
      "困った",
    ],
    sadness: ["悲", "泣", "孤独", "だめ", "ダメ", "消え", "消えたい", "死にたい"],
    progress: [
      "できた",
      "できる",
      "いける",
      "いけそう",
      "やれる",
      "やれそう",
      "やる",
      "やります",
      "やってみる",
      "やってみます",
      "進んだ",
      "達成",
      "完成",
      "直った",
      "解決",
      "完了",
      "うまくいった",
      "よかった",
      "安心した",
      "落ち着いた",
      "成功",
      "続ける",
      "続けます",
      "頑張る",
      "頑張ります",
      "がんばる",
      "がんばります",
      "そうする",
      "そうするよ",
      "やっていく",
      "やっていきます",
      "大丈夫",
      "いけそうだ",
      "いけそうです",
      "前に進む",
      "前に進みます",
      "決めた",
      "決めます",
      "決断した",
      "決断します",
      "覚悟ができた",
      "やりきる",
      "やりきります",
      "役に立つ",
      "役に立てる",
      "届けたい",
      "広げたい",
      "世に出したい",
      "世の中に出したい",
      "一歩踏み出",
      "前向きな行動",
    ],
    planning: [
      "次",
      "やること",
      "優先",
      "計画",
      "準備",
      "整理",
      "進め方",
      "目標",
      "予定",
      "どうする",
    ],
    gratitude: ["ありがとう", "助か", "感謝"],
  };

  const en = {
    anger: ["angry", "pissed", "mad", "furious"],
    anxiety: [
      "anxious",
      "anxiety",
      "panic",
      "scared",
      "afraid",
      "worried",
      "unclear",
      "overwhelmed",
    ],
    sadness: ["sad", "depressed", "hopeless", "want to disappear", "want to die"],
    progress: [
      "done",
      "better",
      "completed",
      "resolved",
      "it worked",
      "i feel better",
      "relieved",
      "calmer",
      "successful",
      "i can do this",
      "i can do it",
      "i will do it",
      "i'll do it",
      "i will try",
      "i'll try",
      "let's do this",
      "i got this",
      "sounds good",
      "okay let's do it",
      "i'm ready",
      "i am ready",
      "keep going",
      "moving forward",
      "i decided",
      "i've decided",
      "decision made",
      "i'm committed",
      "i am committed",
      "help people",
      "be useful",
      "make a difference",
      "put it out",
      "launch it",
      "ship it",
      "take a step forward",
      "take the first step",
    ],
    planning: [
      "next",
      "plan",
      "todo",
      "priority",
      "prepare",
      "organize",
      "goal",
      "schedule",
    ],
    gratitude: ["thanks", "thank you", "appreciate"],
  };

  if (uiLang === "ja") {
    const hit = (arr: string[]) => hitIncludes(sLower, arr);

    if (hit(ja.anger)) return "anger";
    if (hit(ja.anxiety)) return "anxiety";
    if (hit(ja.sadness)) return "sadness";
    if (hit(ja.gratitude)) return "gratitude";
    if (hit(ja.progress)) return "progress";
    if (hit(ja.planning)) return "planning";
    return null;
  } else {
    const hit = (arr: string[]) => hitWordsEn(sLower, arr);
    if (hit(en.anger)) return "anger";
    if (hit(en.anxiety)) return "anxiety";
    if (hit(en.sadness)) return "sadness";
    if (hit(en.gratitude)) return "gratitude";
    if (hit(en.progress)) return "progress";
    if (hit(en.planning)) return "planning";
    return null;
  }
}

type ScoreDeltaMeta = {
  any_hits: boolean;
};

function scoreDeltaWithMeta(
  text: string,
  uiLang: Lang
): { delta: number; meta: ScoreDeltaMeta } {
  const raw = String(text ?? "");
  const sLower = raw.toLowerCase();

  let dBase = 0;

  if (uiLang === "ja") {
    if (hitIncludes(sLower, ["ふざけ", "最悪", "むかつ"])) dBase -= 10;

    if (hitIncludes(sLower, ["消えたい"])) dBase -= 10;
    if (hitIncludes(sLower, ["死にたい"])) dBase -= 10;

    if (/死(んだ|んで|ぬ|にそう|にたい|にます|ぬかも|んじゃ)/.test(sLower)) {
      dBase -= 8;
    }

    if (
      hitIncludes(sLower, [
        "不安",
        "こわ",
        "怖",
        "焦",
        "つら",
        "辛",
        "しんど",
        "無理",
        "迷い",
        "困った",
        "わからない",
        "分からない",
      ])
    ) {
      dBase -= 7;
    }
    if (hitIncludes(sLower, ["助けて", "どうしよう", "もうだめ"])) dBase -= 5;

    if (hitIncludes(sLower, ["ありがとう", "助かる", "感謝"])) dBase += 3;

    if (
      hitIncludes(sLower, [
        "やる",
        "やります",
        "やるよ",
        "やってみる",
        "やってみます",
        "そうする",
        "そうするよ",
        "続ける",
        "続けます",
        "やっていく",
        "やっていきます",
      ])
    ) {
      dBase += 2;
    }

    if (
      hitIncludes(sLower, [
        "いける",
        "いけそう",
        "やれる",
        "やれそう",
        "いけそうだ",
        "いけそうです",
        "大丈夫",
        "頑張る",
        "頑張ります",
        "がんばる",
        "がんばります",
        "できる",
        "前に進む",
        "前に進みます",
      ])
    ) {
      dBase += 3;
    }

    if (
      hitIncludes(sLower, [
        "進んだ",
        "達成",
        "完成",
        "できた",
        "直った",
        "解決",
        "完了",
        "うまくいった",
        "よかった",
        "安心した",
        "落ち着いた",
        "成功",
        "決めた",
        "決めます",
        "決断した",
        "決断します",
        "覚悟ができた",
        "やりきる",
        "やりきります",
      ])
    ) {
      dBase += 5;
    }

    if (
      hitIncludes(sLower, [
        "整理",
        "次",
        "やること",
        "優先",
        "計画",
        "準備",
        "進め方",
        "目標",
        "予定",
        "どうする",
      ])
    ) {
      dBase += 2;
    }

    const hasHopy = hitIncludes(sLower, ["hopy"]);
    const hasWorld = hitIncludes(sLower, ["世界", "世界中", "世の中", "世に出", "広ま"]);
    const hasHelp = hitIncludes(sLower, ["役に立", "助け", "支え", "救い", "届いてほしい"]);
    const hasPositiveMove = hitIncludes(sLower, [
      "前向き",
      "一歩踏み出",
      "行動",
      "進める",
      "進み出",
      "踏み出",
    ]);
    const hasJoyWish = hitIncludes(sLower, [
      "うれしい",
      "嬉しい",
      "最高",
      "願",
      "叶えたい",
      "届けたい",
      "広げたい",
    ]);

    if (hasHopy && hasWorld && hasHelp) dBase += 8;
    else if (hasWorld && hasHelp && hasPositiveMove) dBase += 8;
    else if (hasHopy && hasHelp && hasJoyWish) dBase += 7;
    else if (hasHopy && hasWorld && hasJoyWish) dBase += 7;
    else if ((hasWorld && hasHelp) || (hasHopy && hasHelp) || (hasHopy && hasWorld)) dBase += 5;
  } else {
    if (hitWordsEn(sLower, ["hate", "worst"])) dBase -= 10;

    if (hitWordsEn(sLower, ["suicide"])) dBase -= 10;
    if (hitWordsEn(sLower, ["kill myself"])) dBase -= 10;
    if (hitWordsEn(sLower, ["want to die"])) dBase -= 10;
    if (hitWordsEn(sLower, ["kill"])) dBase -= 8;

    if (hitWordsEn(sLower, ["can't", "cannot"])) dBase -= 6;

    if (
      hitWordsEn(sLower, [
        "anxious",
        "anxiety",
        "panic",
        "scared",
        "afraid",
        "worried",
        "stressed",
        "unclear",
        "overwhelmed",
      ])
    ) {
      dBase -= 7;
    }
    if (hitWordsEn(sLower, ["help me"])) dBase -= 5;
    if (hitWordsEn(sLower, ["what should i do"])) dBase -= 5;

    if (hitWordsEn(sLower, ["thanks", "thank you", "appreciate"])) dBase += 3;

    if (
      hitWordsEn(sLower, [
        "i will",
        "i will try",
        "i'll try",
        "i will do it",
        "i'll do it",
        "let's do this",
        "keep going",
      ])
    ) {
      dBase += 2;
    }

    if (
      hitWordsEn(sLower, [
        "i can do this",
        "i can do it",
        "sounds good",
        "i'm ready",
        "i am ready",
        "moving forward",
        "better",
        "calmer",
      ])
    ) {
      dBase += 3;
    }

    if (
      hitWordsEn(sLower, [
        "done",
        "completed",
        "resolved",
        "it worked",
        "i feel better",
        "relieved",
        "successful",
        "i decided",
        "i've decided",
        "decision made",
        "i'm committed",
        "i am committed",
      ])
    ) {
      dBase += 5;
    }

    if (
      hitWordsEn(sLower, [
        "next",
        "plan",
        "todo",
        "priority",
        "prepare",
        "organize",
        "goal",
        "schedule",
      ])
    ) {
      dBase += 2;
    }

    const hasHopy = hitWordsEn(sLower, ["hopy"]);
    const hasWorld = hitWordsEn(sLower, ["world", "people", "public"]) || hitIncludes(sLower, ["launch", "ship", "release"]);
    const hasHelp = hitWordsEn(sLower, ["help", "support", "useful"]) || hitIncludes(sLower, ["make a difference"]);
    const hasPositiveMove =
      hitIncludes(sLower, ["take a step forward", "take the first step", "moving forward"]) ||
      hitWordsEn(sLower, ["action"]);
    const hasJoyWish =
      hitWordsEn(sLower, ["happy", "glad", "best", "joy"]) ||
      hitIncludes(sLower, ["hope", "wish", "would love to"]);

    if (hasHopy && hasWorld && hasHelp) dBase += 8;
    else if (hasWorld && hasHelp && hasPositiveMove) dBase += 8;
    else if (hasHopy && hasHelp && hasJoyWish) dBase += 7;
    else if (hasHopy && hasWorld && hasJoyWish) dBase += 7;
    else if ((hasWorld && hasHelp) || (hasHopy && hasHelp) || (hasHopy && hasWorld)) dBase += 5;
  }

  const anyHits = dBase !== 0;

  return {
    delta: clampDelta(dBase),
    meta: {
      any_hits: anyHits,
    },
  };
}

export function scoreDelta(text: string, uiLang: Lang): number {
  return scoreDeltaWithMeta(text, uiLang).delta;
}

export type StabilizedDelta = {
  delta_raw: number;
  delta_guarded: number;
  delta_applied: number;
  is_dev_context: boolean;
  is_cooldown: boolean;
  neg_streak_prev: number;
  neg_streak_next: number;
  reasons: string[];
};

export function stabilizedDelta(params: {
  text: string;
  uiLang: Lang;
  updatedAt: string | null | undefined;
  minIntervalSec: number;
  negStreakPrev: number;
}): StabilizedDelta {
  const rawText = String(params.text ?? "");
  const sLower = rawText.toLowerCase();

  const explicit = isExplicitSelfHarm(sLower, params.uiLang);

  const cooldown = shouldSkipStateUpdateByCooldown(
    params.updatedAt,
    params.minIntervalSec
  );

  const reasons: string[] = [];
  reasons.push(SCORE_SIG);

  const { delta: dRaw, meta } = scoreDeltaWithMeta(rawText, params.uiLang);

  let dGuarded = dRaw;

  const negPrev = clampInt(params.negStreakPrev ?? 0, 0, 9999);

  let negNext = negPrev;
  if (dGuarded < 0) negNext = negPrev + 1;
  else negNext = 0;

  let dApplied = dGuarded;

  if (!explicit && dGuarded < 0) {
    const step = clampInt(negNext - 1, 0, PER_MESSAGE_ABS_MAX);
    const mag = Math.min(Math.abs(dGuarded), PER_MESSAGE_ABS_MAX);
    const appliedMag = Math.min(step, mag);

    if (appliedMag === 0) {
      if (NEG_FIRST_MIN_APPLY >= 1 && negNext === 1) {
        dApplied = -1;
        reasons.push("neg_first_min_apply");
      } else {
        dApplied = 0;
        reasons.push("neg_streak_hold");
      }
    } else {
      dApplied = -appliedMag;
      reasons.push("neg_streak_stepdown");
    }
  }

  const beforeClip = dApplied;
  dApplied = clampPerMessage(dApplied);
  if (dApplied !== beforeClip) reasons.push("per_message_clip");

  if (cooldown) {
    if (dApplied !== 0) reasons.push("cooldown_skip");
    dApplied = 0;
  }

  if (!cooldown && dRaw === 0) {
    reasons.push("delta_zero");
    if (!meta.any_hits) reasons.push("delta_zero_no_hits");
  }

  if (!explicit && dRaw !== 0) reasons.push("delta_nonzero");

  return {
    delta_raw: dRaw,
    delta_guarded: dGuarded,
    delta_applied: dApplied,
    is_dev_context: false,
    is_cooldown: cooldown,
    neg_streak_prev: negPrev,
    neg_streak_next: negNext,
    reasons,
  };
}

export function phaseFromScore(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score <= PHASE1_MAX) return 1;
  if (score <= PHASE2_MAX) return 2;
  if (score <= PHASE3_MAX) return 3;
  if (score <= PHASE4_MAX) return 4;
  return 5;
}

export function phaseFromScoreHysteresis(params: {
  score: number;
  prevPhase: number | null | undefined;
}): 1 | 2 | 3 | 4 | 5 {
  const score = params.score;
  const prev =
    typeof params.prevPhase === "number"
      ? clampInt(Math.round(params.prevPhase), 1, 5)
      : null;

  if (prev == null) return phaseFromScore(score);

  const target = phaseFromScore(score);

  if (target === prev) return target;

  if (target > prev) {
    if (prev === 1 && score > PHASE1_MAX + PHASE_HYSTERESIS) return target;
    if (prev === 2 && score > PHASE2_MAX + PHASE_HYSTERESIS) return target;
    if (prev === 3 && score > PHASE3_MAX + PHASE_HYSTERESIS) return target;
    if (prev === 4 && target === 5) return target;
    return prev as 1 | 2 | 3 | 4 | 5;
  }

  if (prev === 2 && score <= PHASE1_MAX - PHASE_HYSTERESIS) return target;
  if (prev === 3 && score <= PHASE2_MAX - PHASE_HYSTERESIS) return target;
  if (prev === 4 && score <= PHASE3_MAX - PHASE_HYSTERESIS) return target;
  if (prev === 5 && score < PHASE4_MAX - PHASE_HYSTERESIS) return target;

  return prev as 1 | 2 | 3 | 4 | 5;
}