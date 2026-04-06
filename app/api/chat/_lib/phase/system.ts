// /app/api/chat/_lib/phase/system.ts
import type { Lang } from "../text";
import { clampInt } from "../env";
import { detectConversationKind, type ConversationKind } from "./intent";

/**
 * Phase system (internal behavior shaping)
 * ---------------------------------------
 * ここは「フェーズ制御」と「会話の角度付け」を担当する。
 * 憲法レイヤー（SYSTEM_CORE）は /_lib/system/system.ts に物理分離し、
 * route.ts の最上段 system role でのみ注入する（このファイルには含めない）。
 */

// conversation scoped
const lastAngleByConv = new Map<string, string>();

type StabilizeKind =
  | "breath"
  | "body"
  | "environment"
  | "micro-plan"
  | "reframe";

const lastStabilizeByConv = new Map<string, StabilizeKind>();

const ACK_EN = [
  "ok",
  "okay",
  "k",
  "thanks",
  "thank you",
  "yes",
  "yep",
  "no",
  "nope",
  "sure",
  "fine",
  "got it",
  "cool",
];

const ACK_JA = [
  "ok",
  "おけ",
  "おっけ",
  "了解",
  "りょうかい",
  "わかった",
  "分かった",
  "はい",
  "うん",
  "ええ",
  "なるほど",
  "ありがとう",
  "ありがと",
  "サンクス",
];

type ConversationStateLike = {
  current_phase?: unknown;
  state_level?: unknown;
  prev_phase?: unknown;
  prev_state_level?: unknown;
  state_changed?: unknown;
} | null;

function normalizePhase5(v: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return clampInt(Math.round(n), 1, 5) as 1 | 2 | 3 | 4 | 5;
}

export function stateCore(state: ConversationStateLike) {
  if (!state) {
    return {
      phase: 1 as 1 | 2 | 3 | 4 | 5,
      prevPhase: 1 as 1 | 2 | 3 | 4 | 5,
      changed: false,
    };
  }

  const phase = normalizePhase5(
    state.state_level ?? state.current_phase ?? 1,
  );
  const prevPhase = normalizePhase5(
    state.prev_state_level ?? state.prev_phase ?? phase,
  );

  if (typeof state.state_changed !== "boolean") {
    throw new Error(
      "phase/system.ts: state.state_changed must come from confirmed payload and is required",
    );
  }

  return {
    phase,
    prevPhase,
    changed: state.state_changed,
  };
}

type Angle = {
  labelJa: string;
  labelEn: string;
  instJa: string;
  instEn: string;
};

function angleCandidates(kind: ConversationKind): Angle[] {
  const base: Angle[] = [
    {
      labelJa: "象徴性",
      labelEn: "Symbolic",
      instJa: "比喩は1層だけ。短く：象徴→いまの現実に戻す。",
      instEn: "One layer of metaphor. Brief: symbol → back to the present.",
    },
    {
      labelJa: "心理学",
      labelEn: "Psychology",
      instJa: "感情/認知として短く説明し、必要なら具体を少し置く。締め方は固定せず、その場に合う自然な終わり方にする。",
      instEn: "Explain via emotion/cognition briefly; add a little concrete help when needed. Do not force a fixed closing pattern.",
    },
    {
      labelJa: "行動提案",
      labelEn: "Action",
      instJa: "提案は多くしすぎない。会話に溶かして自然に置く。",
      instEn: "Do not overload with suggestions. Weave help naturally into the flow.",
    },
    {
      labelJa: "構造化",
      labelEn: "Structure",
      instJa: "事実/論点/選択で最小整理。前置き削る。必要な具体を残し、締めは固定しない。",
      instEn: "Facts / Issues / Choices. Minimal framing. Keep needed specifics, and avoid a fixed closing style.",
    },
    {
      labelJa: "反証・別角度",
      labelEn: "Counter-angle",
      instJa: "別の見方を1つだけ並置。否定しない。結論は短くまとめるが、毎回同じ着地にしない。",
      instEn: "Place ONE alternative view. No negation. Land briefly, but do not reuse the same ending every time.",
    },
    {
      labelJa: "背景（文化・歴史）",
      labelEn: "Context (Culture/History)",
      instJa: "背景は短く1段だけ。情報過多禁止。必要な具体を少し添え、その場に合う自然な終わり方にする。",
      instEn: "One short context layer. No overload. Add only needed specifics and end naturally for this turn.",
    },
  ];

  const buildAngles: Angle[] = [
    {
      labelJa: "切り分け",
      labelEn: "Diagnosis",
      instJa: "現象→条件→原因候補を短く分ける。最有力を1つだけ選ぶ。",
      instEn: "Split: symptoms → conditions → causes. Pick the single most likely.",
    },
    {
      labelJa: "仮説",
      labelEn: "Hypothesis",
      instJa: "前提を1つ明示し、外れた場合の代替も1つだけ添える（合計2本まで）。結論は絞る。",
      instEn: "State ONE assumption and ONE fallback (max two lines). Still land on one focused conclusion.",
    },
    {
      labelJa: "検証",
      labelEn: "Verification",
      instJa: "確かめ方は1つだけ（観察点/期待値を短く）。",
      instEn: "Offer ONE check: what to observe and what you’d expect.",
    },
    {
      labelJa: "制約",
      labelEn: "Constraints",
      instJa: "制約を1行で拾い、選択肢を絞る。提案は増やしすぎない。",
      instEn: "Name constraints in one line to narrow options; do not overload with suggestions.",
    },
    {
      labelJa: "反復",
      labelEn: "Iteration",
      instJa: "小さく試す→学ぶ→次を決める、を“1サイクル”だけ短く置く（説明しすぎない）。",
      instEn: "One loop: try small → learn → decide next, stated once without over-explaining.",
    },
  ];

  const qa: Angle[] = [
    {
      labelJa: "定義→例→境界",
      labelEn: "Define→Example→Boundary",
      instJa: "短い定義→具体例→境界を各1行（合計3行以内）。締め方は内容に合わせて自然に選ぶ。",
      instEn: "Short definition → example → boundary (within 3 lines). Let the ending fit the content naturally.",
    },
    {
      labelJa: "手順化",
      labelEn: "Step-by-step",
      instJa: "手順は最大2つまで。タスク感を出さず、要点として置く。",
      instEn: "Up to 2 steps. Avoid task-manager tone; keep it as focused guidance.",
    },
    {
      labelJa: "トレードオフ",
      labelEn: "Trade-offs",
      instJa: "長所/短所を各1行→結論は1つ（理由短く）。締めは固定せず自然に。",
      instEn: "1-line pros/cons → pick ONE (short reason). Avoid a fixed closing pattern.",
    },
  ];

  if (kind === "build") {
    const structure = base.find((a) => a.labelEn === "Structure")!;
    const action = base.find((a) => a.labelEn === "Action")!;
    return [...buildAngles, structure, action];
  }

  if (kind === "planning" || kind === "meta") {
    const structure = base.find((a) => a.labelEn === "Structure")!;
    return [...qa, structure];
  }

  return base;
}

function randomIndex(max: number): number {
  if (max <= 0) return 0;

  try {
    const c: any = (globalThis as any).crypto;
    if (c?.getRandomValues) {
      const u = new Uint32Array(1);
      c.getRandomValues(u);
      return Number(u[0] % max);
    }
  } catch {}

  return Math.floor(Math.random() * max);
}

function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hasJapanese(s: string) {
  return /[ぁ-んァ-ン一-龠]/.test(s);
}

function isAckLike(t: string, uiLang: Lang) {
  const s = String(t ?? "").trim().toLowerCase();
  if (!s) return true;

  const list = uiLang === "en" ? ACK_EN : ACK_JA;
  return list.some((w) => s === w || s === w.replace(/\s/g, ""));
}

function isPhase1LightAck(params: {
  uiLang: Lang;
  phase: 1 | 2 | 3 | 4 | 5;
  userText: string;
}) {
  const { uiLang, phase, userText } = params;
  if (phase !== 1) return false;

  const compact = String(userText ?? "").trim().replace(/\s/g, "");
  return isAckLike(compact, uiLang);
}

function pickOneAngle(params: {
  kind: ConversationKind;
  uiLang: Lang;
  phase: 1 | 2 | 3 | 4 | 5;
  userText: string;
  conversationId?: string;
}): Angle | null {
  const { kind, uiLang, userText, conversationId, phase } = params;
  const cands = angleCandidates(kind);
  if (!cands.length) return null;

  const t = String(userText ?? "").trim();
  const compact = t.replace(/\s/g, "");

  if (
    isPhase1LightAck({
      uiLang,
      phase,
      userText,
    })
  ) {
    return null;
  }

  const kindAllowsRandom = kind === "emotion" || kind === "casual";
  const allowRandom =
    kindAllowsRandom &&
    !isAckLike(compact, uiLang) &&
    (compact.length >= 2 || hasJapanese(compact));

  const convKey =
    conversationId && conversationId.trim() ? conversationId.trim() : "";
  const prev = convKey ? lastAngleByConv.get(convKey) ?? null : null;

  if (allowRandom) {
    let chosen = cands[randomIndex(cands.length)] ?? cands[0];

    if (prev && cands.length >= 2 && convKey) {
      for (let i = 0; i < 2; i++) {
        const labelNow = uiLang === "en" ? chosen.labelEn : chosen.labelJa;
        if (labelNow !== prev) break;
        chosen = cands[randomIndex(cands.length)] ?? cands[0];
      }
    }

    if (convKey) {
      const labelNow = uiLang === "en" ? chosen.labelEn : chosen.labelJa;
      lastAngleByConv.set(convKey, labelNow);
      if (lastAngleByConv.size > 5000) lastAngleByConv.clear();
    }

    return chosen;
  }

  const seed = `${uiLang}|${String(kind)}|${compact}`;
  const idx = fnv1a32(seed) % cands.length;
  const chosen = cands[idx] ?? cands[0];

  if (convKey) {
    const labelNow = uiLang === "en" ? chosen.labelEn : chosen.labelJa;
    lastAngleByConv.set(convKey, labelNow);
    if (lastAngleByConv.size > 5000) lastAngleByConv.clear();
  }

  return chosen;
}

function formatAngleBlock(params: {
  kind: ConversationKind;
  uiLang: Lang;
  phase: 1 | 2 | 3 | 4 | 5;
  userText: string;
  conversationId?: string;
}) {
  const { kind, uiLang, phase, userText, conversationId } = params;

  if (
    isPhase1LightAck({
      uiLang,
      phase,
      userText,
    })
  ) {
    return "";
  }

  const chosen = pickOneAngle({
    kind,
    uiLang,
    phase,
    userText,
    conversationId,
  });
  if (!chosen) return "";

  const inst = uiLang === "en" ? chosen.instEn : chosen.instJa;

  return uiLang === "en"
    ? [
        `Angle: ${inst}`,
        `Internal-only: never output Angle/Rules tags; avoid generic endings; avoid repeating templates; keep the output focused and natural for this turn; avoid closing with questions or checklist-like tasks.`,
        phase === 1
          ? `State1: stabilization allowed; do NOT default to breathing.`
          : ``,
      ]
        .filter(Boolean)
        .join("\n")
    : [
        `角度: ${inst}`,
        `内部専用: 角度/ルール等のラベルを出力しない／汎用締め禁止／同型反復回避／このターンに合う自然なまとまり方を優先する／質問締め・タスク締め（ToDo感）を避ける`,
        phase === 1
          ? `状態1: 安定化OK。ただし深呼吸固定は禁止。`
          : ``,
      ]
        .filter(Boolean)
        .join("\n");
}

function pickStabilizeKind(params: {
  uiLang: Lang;
  phase: 1 | 2 | 3 | 4 | 5;
  userText: string;
  conversationId?: string;
}): StabilizeKind {
  const { uiLang, phase, userText, conversationId } = params;

  if (phase > 1) return "micro-plan";

  const t = String(userText ?? "").trim().toLowerCase();
  const compact = t.replace(/\s/g, "");
  const convKey =
    conversationId && conversationId.trim() ? conversationId.trim() : "";
  const prev = convKey ? lastStabilizeByConv.get(convKey) ?? null : null;

  const askedBreath =
    /呼吸|息|深呼吸/.test(userText) ||
    /\b(breath|breathing)\b/.test(t) ||
    /inhale|exhale/.test(t);

  const pool: StabilizeKind[] = askedBreath
    ? ["breath", "body", "environment", "micro-plan", "reframe"]
    : ["body", "environment", "micro-plan", "reframe", "breath"];

  const ackLike = isAckLike(compact, uiLang);
  const pool2: StabilizeKind[] = ackLike
    ? askedBreath
      ? ["breath", "body", "environment", "reframe"]
      : ["body", "environment", "reframe", "breath"]
    : pool;

  let chosen = pool2[randomIndex(pool2.length)] ?? pool2[0];

  if (prev && pool2.length >= 2 && convKey) {
    for (let i = 0; i < 2; i++) {
      if (chosen !== prev) break;
      chosen = pool2[randomIndex(pool2.length)] ?? pool2[0];
    }
  }

  if (convKey) {
    lastStabilizeByConv.set(convKey, chosen);
    if (lastStabilizeByConv.size > 5000) lastStabilizeByConv.clear();
  }

  return chosen;
}

function formatStabilizeRule(params: {
  uiLang: Lang;
  phase: 1 | 2 | 3 | 4 | 5;
  userText: string;
  conversationId?: string;
}): string {
  const { uiLang, phase, userText, conversationId } = params;

  if (phase > 1) return "";

  if (
    isPhase1LightAck({
      uiLang,
      phase,
      userText,
    })
  ) {
    return "";
  }

  const kind = pickStabilizeKind({ uiLang, phase, userText, conversationId });

  if (uiLang === "en") {
    const line =
      kind === "breath"
        ? "BREATH (one short cue)"
        : kind === "body"
          ? "BODY (one sensory cue)"
          : kind === "environment"
            ? "ENV (one small external adjustment)"
            : kind === "reframe"
              ? "REFRAME (one gentle reinterpretation)"
              : "MICRO-PLAN (one tiny next step)";

    return [
      "State1 stabilize (internal):",
      "Breathing is optional; do NOT default to breathing.",
      `Type: ${line}`,
    ].join("\n");
  }

  const line =
    kind === "breath"
      ? "呼吸（短く1回）"
      : kind === "body"
        ? "身体（感覚へ戻す1つ）"
        : kind === "environment"
          ? "環境（外側を小さく整える1つ）"
          : kind === "reframe"
            ? "視点（やさしい言い換え1つ）"
            : "ミクロ計画（次の行動を極小化1つ）";

  return [
    "状態1 安定化（内部）:",
    "深呼吸は任意。固定は禁止。",
    `種別: ${line}`,
  ].join("\n");
}

function clampPrompt(s: string, maxChars: number): string {
  const t = String(s ?? "");
  if (!t.trim()) return "";
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars).trimEnd() + "\n…(truncated)";
}

function phaseGuide(uiLang: Lang, phase: 1 | 2 | 3 | 4 | 5): string {
  if (uiLang === "en") {
    if (phase === 1) {
      return "State1 (internal): stabilize first; keep it short; offer one small foothold when useful; do not end with a question.";
    }
    if (phase === 2) {
      return "State2 (internal): keep it minimal and specific; avoid generic advice; add a small concrete point when useful; do not force a fixed closing line.";
    }
    if (phase === 3) {
      return "State3 (internal): organize gently; clarify what matters now; concrete help is allowed, but keep it natural and not over-structured.";
    }
    if (phase === 4) {
      return "State4 (internal): support convergence; narrow options calmly; keep the ending natural and avoid repeating templates.";
    }
    return "State5 (internal): support decision without pressure; keep it clear and steady; avoid lecturing or a fixed triumphant closing.";
  }

  if (phase === 1) {
    return "状態1（内部）: まず安定化。短く。必要なら小さな足場を1つ置く。質問で終わらない。";
  }
  if (phase === 2) {
    return "状態2（内部）: 最小で具体。一般論に逃げない。必要に応じて小さな具体支援を入れる。締め方を固定しない。";
  }
  if (phase === 3) {
    return "状態3（内部）: やさしく整理する。いま大事な点を見えやすくする。具体支援は自然に入れる。";
  }
  if (phase === 4) {
    return "状態4（内部）: 収束を支える。選択肢を静かに絞る。毎回同じ締め方にしない。";
  }
  return "状態5（内部）: 決定を圧で押さない。明確で落ち着いた支え方にする。説教や大げさな締めはしない。";
}

function phaseGuideForLightAck(uiLang: Lang): string {
  if (uiLang === "en") {
    return "State1 (internal): for brief acknowledgements, keep the reply light. Do not force stabilization, reframing, or forward movement, and do not infer a state shift from the wording alone.";
  }

  return "状態1（内部）: 短い相づち・お礼では返答を軽く保つ。安定化・言い換え・前進誘導を強制せず、文面だけで状態変化を推測しない。";
}

export function buildPhaseSystem(params: {
  uiLang: Lang;
  state: ConversationStateLike;
  userText: string;
  conversationId?: string;
}) {
  const { uiLang, state, userText, conversationId } = params;
  const { phase, prevPhase, changed } = stateCore(state);

  const kind: ConversationKind = detectConversationKind(userText, uiLang);
  const lightAck = isPhase1LightAck({
    uiLang,
    phase,
    userText,
  });

  const stateLine =
    uiLang === "en"
      ? `State(internal): current=${phase} prev=${prevPhase} changed=${changed} kind=${kind}`
      : `状態(内部): current=${phase} prev=${prevPhase} changed=${changed} kind=${kind}`;

  const stabilizeRule = formatStabilizeRule({
    uiLang,
    phase,
    userText,
    conversationId,
  });

  const angleBlock = formatAngleBlock({
    kind,
    uiLang,
    phase,
    userText,
    conversationId,
  });

  const SYSTEM_MAX_CHARS = clampInt(
    Number(process.env.HOPY_SYSTEM_MAX_CHARS ?? "12000"),
    4000,
    30000,
  );

  const system = [
    stateLine,
    lightAck ? phaseGuideForLightAck(uiLang) : phaseGuide(uiLang, phase),
    stabilizeRule,
    angleBlock,
  ]
    .filter((x) => String(x ?? "").trim())
    .join("\n\n");

  return clampPrompt(system, SYSTEM_MAX_CHARS);
}

/*
このファイルの正式役割
phase system の内部指示を組み立てるファイル。
入力前の会話状態をもとに、今回ターンで使う内部向けの phase / angle / stabilize 指示を作る。
ただし HOPY回答○ の唯一の正を再計算する層ではなく、確定済みの state_changed をそのまま参照する補助層である。
*/

/*
【今回このファイルで修正したこと】
- 状態1の短い相づち・お礼を isPhase1LightAck(...) で明示判定するようにしました。
- 状態1の短い相づち・お礼では、angle 指示を出さないようにしました。
- 状態1の短い相づち・お礼では、stabilize 指示を出さないようにしました。
- 状態1の短い相づち・お礼では、通常の phaseGuide ではなく「軽く返す・文面だけで状態変化を推測しない」専用ガイドを使うようにしました。
- state_changed の唯一の正そのものはこのファイルで再計算せず、confirmed payload から来た値をそのまま使う構造は維持しています。
*/

/* /app/api/chat/_lib/phase/system.ts */