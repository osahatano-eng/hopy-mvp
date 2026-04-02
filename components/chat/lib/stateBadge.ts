// /components/chat/lib/stateBadge.ts
import type React from "react";
import type { HopyPhaseValue } from "./chatTypes";

export type HopyPlanValue = "free" | "plus" | "pro";

export type HopyState =
  | {
      current_phase?: HopyPhaseValue | null;
      stability_score?: number | null;
      last_trigger?: string | null;
      updated_at?: string | null;
      state_level?: HopyPhaseValue | null;
      prev_phase?: HopyPhaseValue | null;
      prev_state_level?: HopyPhaseValue | null;
      state_changed?: boolean | null;
      user_name?: string | null;
      user_image_url?: string | null;
      plan?: HopyPlanValue | null;
    }
  | null;

/**
 * HOPY MASTER:
 * - UIは白黒基調、線/影/グラデは禁止
 * - “状態”は色で語らず、ラベルと文で語る
 *
 * style は互換のため残すが「任意」に変更。
 * 以後UI側は style に依存しない（CSSで統一管理する）。
 */
export type StateBadge = {
  label: string;
  titleText: string;
  tooltipLines: string[];
  style?: React.CSSProperties;
};

export type SemanticStateKey = "noise" | "explore" | "organize" | "converge" | "decide";

export type HopyStateVisual = {
  phase: HopyPhaseValue;
  level: HopyPhaseValue;
  key: SemanticStateKey;
  label: string;
  shortLabel: string;
  dotToken: "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
  dotColor: string;
  memoryTone: "phase1" | "phase2" | "phase3" | "phase4" | "phase5";
};

function clampPhase(x: number): HopyPhaseValue {
  if (!Number.isFinite(x)) return 1;
  const n = Math.round(x);
  if (n <= 1) return 1;
  if (n === 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 4;
  return 5;
}

function clampScore(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(-100, Math.min(100, Math.round(x)));
}

function safeStr(x: any) {
  if (typeof x === "string") return x;
  try {
    return JSON.stringify(x);
  } catch {
    return String(x ?? "");
  }
}

function clampText(s: string, max = 120) {
  const t = String(s ?? "").trim();
  if (!t) return "";
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + "…";
}

function dotTokenToColor(token: "phase1" | "phase2" | "phase3" | "phase4" | "phase5") {
  if (token === "phase1") return "var(--hopy-state-phase1, #8f3b3b)";
  if (token === "phase2") return "var(--hopy-state-phase2, #9a6a2f)";
  if (token === "phase3") return "var(--hopy-state-phase3, #8a8f36)";
  if (token === "phase4") return "var(--hopy-state-phase4, #2f7a59)";
  return "var(--hopy-state-phase5, #2f5f8f)";
}

function readNumeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  return null;
}

function readText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function readLevelCandidate(v: unknown): HopyPhaseValue | null {
  const n = readNumeric(v);
  if (n == null) return null;
  if (n >= 1 && n <= 5) return clampPhase(n);
  return null;
}

function readPlanCandidate(v: unknown): HopyPlanValue | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "free") return "free";
  if (s === "plus") return "plus";
  if (s === "pro") return "pro";
  return null;
}

function collectStateSources(s: any): any[] {
  if (!s || typeof s !== "object") return [];

  const out: any[] = [];

  if (s?.assistant_state && typeof s.assistant_state === "object") {
    out.push(s.assistant_state);
  }

  if (s?.assistantState && typeof s.assistantState === "object") {
    out.push(s.assistantState);
  }

  if (s?.profile && typeof s.profile === "object") {
    out.push(s.profile);
  }

  if (s?.user && typeof s.user === "object") {
    out.push(s.user);
  }

  if (s?.auth_user && typeof s.auth_user === "object") {
    out.push(s.auth_user);
  }

  if (s?.authUser && typeof s.authUser === "object") {
    out.push(s.authUser);
  }

  out.push(s);

  return out;
}

function pickFirstLevel(
  sources: any[],
  readers: Array<(src: any) => unknown>
): HopyPhaseValue | null {
  for (const src of sources) {
    for (const reader of readers) {
      const resolved = readLevelCandidate(reader(src));
      if (resolved != null) return resolved;
    }
  }
  return null;
}

function pickFirstText(
  sources: any[],
  readers: Array<(src: any) => unknown>
): string | null {
  for (const src of sources) {
    for (const reader of readers) {
      const resolved = readText(reader(src));
      if (resolved != null) return resolved;
    }
  }
  return null;
}

function pickFirstPlan(
  sources: any[],
  readers: Array<(src: any) => unknown>
): HopyPlanValue | null {
  for (const src of sources) {
    for (const reader of readers) {
      const resolved = readPlanCandidate(reader(src));
      if (resolved != null) return resolved;
    }
  }
  return null;
}

// APIやDBの揺れを吸収して安全に扱う
// Freeでは assistant回答時の確定状態だけを正として扱う
export function normalizeHopyState(s: any): HopyState {
  if (!s) return null;

  const sources = collectStateSources(s);
  if (sources.length === 0) return null;

  const currentPhase = pickFirstLevel(sources, [
    (src) => src?.current_phase,
    (src) => src?.currentPhase,
    (src) => src?.state_level,
    (src) => src?.stateLevel,
  ]);

  const prevPhase = pickFirstLevel(sources, [
    (src) => src?.prev_phase,
    (src) => src?.prevPhase,
    (src) => src?.prev_state_level,
    (src) => src?.prevStateLevel,
  ]);

  const scoreCandidates = sources.flatMap((src) => [
    src?.stability_score,
    src?.stabilityScore,
    src?.score,
  ]);
  let stabilityScore: number | null = null;
  for (const v of scoreCandidates) {
    const resolved = readNumeric(v);
    if (resolved != null) {
      stabilityScore = clampScore(resolved);
      break;
    }
  }

  const changedCandidates = sources.flatMap((src) => [
    src?.state_changed,
    src?.stateChanged,
    src?.changed,
  ]);
  let stateChanged: boolean | null = null;
  for (const v of changedCandidates) {
    const resolved = readBool(v);
    if (resolved != null) {
      stateChanged = resolved;
      break;
    }
  }

  let lastTrigger: string | null = null;
  for (const src of sources) {
    if (typeof src?.last_trigger === "string") {
      lastTrigger = src.last_trigger;
      break;
    }
  }

  let updatedAt: string | null = null;
  for (const src of sources) {
    if (typeof src?.updated_at === "string") {
      updatedAt = src.updated_at;
      break;
    }
  }

  const userName = pickFirstText(sources, [
    (src) => src?.user_name,
    (src) => src?.userName,
    (src) => src?.display_name,
    (src) => src?.displayName,
    (src) => src?.name,
    (src) => src?.full_name,
    (src) => src?.fullName,
  ]);

  const userImageUrl = pickFirstText(sources, [
    (src) => src?.user_image_url,
    (src) => src?.userImageUrl,
    (src) => src?.avatar_url,
    (src) => src?.avatarUrl,
    (src) => src?.picture,
    (src) => src?.image,
  ]);

  const plan = pickFirstPlan(sources, [
    (src) => src?.plan,
    (src) => src?.profile_plan,
    (src) => src?.profilePlan,
  ]);

  if (currentPhase == null) {
    if (userName == null && userImageUrl == null && plan == null) return null;

    return {
      current_phase: null,
      stability_score: stabilityScore ?? 0,
      last_trigger: lastTrigger,
      updated_at: updatedAt,
      state_level: null,
      prev_phase: null,
      prev_state_level: null,
      state_changed: stateChanged,
      user_name: userName,
      user_image_url: userImageUrl,
      plan,
    };
  }

  const safeCurrentPhase = clampPhase(currentPhase);
  const safePrevPhase = prevPhase == null ? safeCurrentPhase : clampPhase(prevPhase);

  return {
    current_phase: safeCurrentPhase,
    stability_score: stabilityScore ?? 0,
    last_trigger: lastTrigger,
    updated_at: updatedAt,
    state_level: safeCurrentPhase,
    prev_phase: safePrevPhase,
    prev_state_level: safePrevPhase,
    state_changed: stateChanged,
    user_name: userName,
    user_image_url: userImageUrl,
    plan,
  };
}

function fmtUpdatedAt(updated_at: string | null | undefined, uiLang: "ja" | "en") {
  if (!updated_at) return null;
  const d = new Date(updated_at);
  if (Number.isNaN(d.getTime())) return null;

  try {
    return uiLang === "en"
      ? d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

export function phaseToSemanticKey(phase: HopyPhaseValue): SemanticStateKey {
  if (phase === 1) return "noise";
  if (phase === 2) return "explore";
  if (phase === 3) return "organize";
  if (phase === 4) return "converge";
  return "decide";
}

export function phaseToStateLevel(phase: HopyPhaseValue): HopyPhaseValue {
  return phase;
}

export function stateLevelToSemanticKey(level: HopyPhaseValue): SemanticStateKey {
  if (level === 1) return "noise";
  if (level === 2) return "explore";
  if (level === 3) return "organize";
  if (level === 4) return "converge";
  return "decide";
}

export function phaseToLocalizedLabel(phase: HopyPhaseValue, uiLang: "ja" | "en") {
  const key = phaseToSemanticKey(phase);

  if (uiLang === "en") {
    if (key === "noise") return "Noise";
    if (key === "explore") return "Explore";
    if (key === "organize") return "Organize";
    if (key === "converge") return "Converge";
    return "Decide";
  }

  if (key === "noise") return "混線";
  if (key === "explore") return "模索";
  if (key === "organize") return "整理";
  if (key === "converge") return "収束";
  return "決定";
}

export function stateLevelToLocalizedLabel(level: HopyPhaseValue, uiLang: "ja" | "en") {
  const key = stateLevelToSemanticKey(level);

  if (uiLang === "en") {
    if (key === "noise") return "Noise";
    if (key === "explore") return "Explore";
    if (key === "organize") return "Organize";
    if (key === "converge") return "Converge";
    return "Decide";
  }

  if (key === "noise") return "混線";
  if (key === "explore") return "模索";
  if (key === "organize") return "整理";
  if (key === "converge") return "収束";
  return "決定";
}

export function getHopyStateVisual(params: {
  state?: HopyState;
  phase?: HopyPhaseValue | null;
  level?: HopyPhaseValue | null;
  uiLang: "ja" | "en";
}): HopyStateVisual {
  const normalizedState = normalizeHopyState(params.state);

  const resolvedLevel =
    params.level ??
    normalizedState?.current_phase ??
    normalizedState?.state_level ??
    params.phase ??
    1;

  const safeLevel = clampPhase(Number(resolvedLevel));
  const safePhase = safeLevel;
  const key = stateLevelToSemanticKey(safeLevel);
  const shortLabel = stateLevelToLocalizedLabel(safeLevel, params.uiLang);
  const label = params.uiLang === "en" ? `State: ${shortLabel}` : `状態: ${shortLabel}`;

  const dotToken =
    safeLevel === 1
      ? "phase1"
      : safeLevel === 2
      ? "phase2"
      : safeLevel === 3
      ? "phase3"
      : safeLevel === 4
      ? "phase4"
      : "phase5";

  return {
    phase: safePhase,
    level: safeLevel,
    key,
    label,
    shortLabel,
    dotToken,
    dotColor: dotTokenToColor(dotToken),
    memoryTone: dotToken,
  };
}

/**
 * last_trigger を UI で読める情報に要約
 * - JSONの全文をtooltipに出すとノイズになるので、要点だけ
 * - JSONでなければ短くクランプして出す
 */
function summarizeTriggerForUi(raw: string | null | undefined, uiLang: "ja" | "en") {
  const t = String(raw ?? "").trim();
  if (!t) return null;

  try {
    const obj: any = JSON.parse(t);

    const tone = typeof obj?.tone === "string" ? obj.tone : "";
    const ctx = obj?.ctx === "dev" ? "dev" : obj?.ctx === "normal" ? "normal" : "";
    const neg =
      typeof obj?.neg_streak === "number" && Number.isFinite(obj.neg_streak)
        ? Math.max(0, Math.round(obj.neg_streak))
        : null;
    const delta =
      typeof obj?.delta_applied === "number" && Number.isFinite(obj.delta_applied)
        ? Math.round(obj.delta_applied)
        : null;

    const reasonsArr = Array.isArray(obj?.reasons) ? obj.reasons : [];
    const reasons = reasonsArr
      .filter((x: any) => typeof x === "string" && x.trim())
      .slice(0, 2)
      .map((x: string) => x.trim());

    const headParts = [
      tone ? `tone=${tone}` : "",
      ctx ? `ctx=${ctx}` : "",
      neg != null ? `neg=${neg}` : "",
      delta != null ? `Δ=${delta}` : "",
    ].filter(Boolean);

    const head = headParts.join(" ");
    const reasonLine =
      reasons.length > 0
        ? uiLang === "en"
          ? `Reasons: ${reasons.join(", ")}`
          : `理由: ${reasons.join("、")}`
        : null;

    const line1 =
      uiLang === "en"
        ? head
          ? `Trigger: ${head}`
          : "Trigger: (data)"
        : head
        ? `トリガー: ${head}`
        : "トリガー: (data)";

    const lines = [line1, reasonLine].filter(Boolean) as string[];
    return lines.length ? lines : null;
  } catch {
    const compact = clampText(t, 120);
    if (!compact) return null;
    return [uiLang === "en" ? `Trigger: ${compact}` : `トリガー: ${compact}`];
  }
}

function buildPhaseLines(phase: HopyPhaseValue, uiLang: "ja" | "en"): string[] {
  const key = phaseToSemanticKey(phase);

  if (uiLang === "en") {
    if (key === "noise") {
      return [
        "State: signals are tangled and the mind is not settled yet.",
        "Try: reduce noise, pause the spread, and restate the core issue in one short sentence.",
      ];
    }
    if (key === "explore") {
      return [
        "State: possibilities are opening up and directions are being explored.",
        "Try: compare a few paths lightly and leave room for discovery.",
      ];
    }
    if (key === "organize") {
      return [
        "State: information is being sorted and the structure is becoming clearer.",
        "Try: separate what is known, unknown, and next.",
      ];
    }
    if (key === "converge") {
      return [
        "State: the flow is gathering into one direction and unnecessary branches are fading.",
        "Try: narrow the options calmly and focus on the strongest route.",
      ];
    }
    return [
      "State: the direction is settled and the next move can be chosen with confidence.",
      "Try: decide on one concrete action and move forward without reopening the whole question.",
    ];
  }

  if (key === "noise") {
    return [
      "状態: 情報や感覚が絡み合い、まだ思考が落ち着いていない段階です。",
      "提案: 広がりをいったん止め、ノイズを減らして、核となる課題を短い1文で言い直す。",
    ];
  }
  if (key === "explore") {
    return [
      "状態: 可能性が開き、進み方を探っている段階です。",
      "提案: 候補を軽く比べながら、発見の余地を残す。",
    ];
  }
  if (key === "organize") {
    return [
      "状態: 情報が整理され、全体の構造が見え始めている段階です。",
      "提案: わかったこと・未確定・次の一手に分ける。",
    ];
  }
  if (key === "converge") {
    return [
      "状態: 流れが一つの方向へ集まり、余分な枝が静かに減っている段階です。",
      "提案: 選択肢を穏やかに絞り、最も強い筋に集中する。",
    ];
  }
  return [
    "状態: 方針が定まり、次の一歩を迷いなく選びやすい段階です。",
    "提案: 具体行動を1つに決め、全体を再び広げず前へ進む。",
  ];
}

export function buildStateBadge(params: {
  state: HopyState;
  uiLang: "ja" | "en";
  ui: {
    stateTitle: string;
    stateUnknownShort: string;
  };
  err?: string | null;
}): StateBadge {
  const { uiLang, ui, err } = params;

  if (err) {
    const label = uiLang === "en" ? "State: Unavailable" : "状態: 取得できません";
    return {
      label,
      titleText: label,
      tooltipLines: [
        uiLang === "en" ? "State info is not available right now." : "状態情報を取得できませんでした。",
        uiLang === "en" ? `Reason: ${safeStr(err)}` : `理由: ${safeStr(err)}`,
      ],
    };
  }

  const state = normalizeHopyState(params.state);

  if (!state || state.current_phase == null) {
    const label = uiLang === "en" ? `State: ${ui.stateUnknownShort}` : `状態: ${ui.stateUnknownShort}`;
    return {
      label,
      titleText: label,
      tooltipLines: [uiLang === "en" ? "Preparing your state..." : "状態を準備中です..."],
    };
  }

  const level = clampPhase(Number(state.current_phase ?? state.state_level ?? 1));
  const score = clampScore(Number(state.stability_score ?? 0));
  const phaseLabel = stateLevelToLocalizedLabel(level, uiLang);
  const label = uiLang === "en" ? `State: ${phaseLabel}` : `状態: ${phaseLabel}`;

  const updated = fmtUpdatedAt(state.updated_at ?? null, uiLang);
  const phaseLines = buildPhaseLines(level, uiLang);
  const updatedLine = updated ? (uiLang === "en" ? `Updated: ${updated}` : `更新: ${updated}`) : null;
  const scoreLine = uiLang === "en" ? `Stability score: ${score}` : `安定スコア: ${score}`;
  const trigLines = summarizeTriggerForUi(state.last_trigger ?? null, uiLang) ?? [];

  const tooltipLines = [...phaseLines, scoreLine, ...trigLines, updatedLine].filter(Boolean) as string[];

  return {
    label,
    titleText: label,
    tooltipLines,
  };
}

/*
このファイルの正式役割
状態表示で使う state の正規化と、状態ラベル/ツールチップ生成を担うファイル。
左カラム最下部ユーザー導線で必要な user_name / user_image_url / plan も、
状態ロジックを壊さない範囲で正規化時に保持する。
*/

/*
【今回このファイルで修正したこと】
stateBadge.ts の HopyState と normalizeHopyState に、
左カラム最下部ユーザー導線で必要な user_name / user_image_url / plan の保持を追加しました。
既存の状態値 1..5 / 5段階の正規化ロジックは変えず、
状態が無いがユーザー導線情報だけあるケースでも null に落とし切らないようにしました。
*/