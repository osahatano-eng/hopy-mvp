// /app/api/chat/_lib/phase/system.ts
import type { Lang } from "../text";
import { clampInt } from "../env";
import { detectConversationKind, type ConversationKind } from "./intent";
import {
  formatHopyPhaseAngleBlock,
  formatHopyStabilizeRule,
  getHopyPhaseAngleCandidates,
  getHopyPhaseGuide,
  getHopyPhaseGuideForLightAck,
  type HopyPhaseAnglePrompt,
  type HopyPhaseLevel,
  type HopyPhasePromptLang,
  type HopyStabilizeKind,
} from "../hopy/prompt/hopyPhaseSystemPrompt";

/**
 * Phase system (internal behavior shaping)
 * ---------------------------------------
 * ここは「フェーズ制御」と「会話の角度付け」を担当する。
 * プロンプト文言は /_lib/hopy/prompt/hopyPhaseSystemPrompt.ts に分離し、
 * このファイルは state / kind / angle / stabilize の選択と組み立てだけを担当する。
 */

// conversation scoped
const lastAngleByConv = new Map<string, string>();

type Phase = HopyPhaseLevel;
type Angle = HopyPhaseAnglePrompt;
type StabilizeKind = HopyStabilizeKind;

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

function toPromptLang(uiLang: Lang): HopyPhasePromptLang {
  return uiLang === "en" ? "en" : "ja";
}

function normalizePhase5(v: unknown): Phase {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return clampInt(Math.round(n), 1, 5) as Phase;
}

export function stateCore(state: ConversationStateLike) {
  if (!state) {
    return {
      phase: 1 as Phase,
      prevPhase: 1 as Phase,
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

function angleCandidates(kind: ConversationKind): Angle[] {
  return getHopyPhaseAngleCandidates(kind);
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
  phase: Phase;
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
  phase: Phase;
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
  phase: Phase;
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

  return formatHopyPhaseAngleBlock({
    uiLang: toPromptLang(uiLang),
    phase,
    angle: chosen,
  });
}

function pickStabilizeKind(params: {
  uiLang: Lang;
  phase: Phase;
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
  phase: Phase;
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

  return formatHopyStabilizeRule({
    uiLang: toPromptLang(uiLang),
    kind,
  });
}

function clampPrompt(s: string, maxChars: number): string {
  const t = String(s ?? "");
  if (!t.trim()) return "";
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars).trimEnd() + "\n…(truncated)";
}

export function buildPhaseSystem(params: {
  uiLang: Lang;
  state: ConversationStateLike;
  userText: string;
  conversationId?: string;
}) {
  const { uiLang, state, userText, conversationId } = params;
  const { phase, prevPhase, changed } = stateCore(state);
  const promptLang = toPromptLang(uiLang);

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
    lightAck
      ? getHopyPhaseGuideForLightAck(promptLang)
      : getHopyPhaseGuide(promptLang, phase),
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
プロンプト文言は /app/api/chat/_lib/hopy/prompt/hopyPhaseSystemPrompt.ts を唯一の参照元とする。
*/

/*
【今回このファイルで修正したこと】
- phase system 用の内部プロンプト文言を /app/api/chat/_lib/hopy/prompt/hopyPhaseSystemPrompt.ts へ分離し、このファイルでは読み込むだけにしました。
- angle 候補、angle block、stabilize rule、phase guide、light ack guide の文言直書きを削除しました。
- このファイルには stateCore、会話種別判定、angle 選択、stabilize 選択、system 組み立ての処理責務だけを残しました。
- state_changed の唯一の正そのものはこのファイルで再計算せず、confirmed payload から来た値をそのまま使う構造を維持しています。
*/

/* /app/api/chat/_lib/phase/system.ts */