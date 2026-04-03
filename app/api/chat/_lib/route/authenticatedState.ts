// /app/api/chat/_lib/route/authenticatedState.ts

import type {
  CanonicalAssistantState,
  ConfirmedAssistantTurn,
} from "./authenticatedTypes";

function isPhase1to5(value: unknown): value is 1 | 2 | 3 | 4 | 5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function normalizeConfirmedStateLevel(
  value: unknown,
): 1 | 2 | 3 | 4 | 5 | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (rounded <= 1) return 1;
    if (rounded >= 5) return 5;
    if (rounded === 2) return 2;
    if (rounded === 3) return 3;
    if (rounded === 4) return 4;
    return null;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    const numeric = Number(s);
    if (Number.isFinite(numeric)) {
      return normalizeConfirmedStateLevel(numeric);
    }

    const lower = s.toLowerCase();
    if (s === "混線" || lower === "mixed") return 1;
    if (s === "模索" || lower === "seeking") return 2;
    if (s === "整理" || lower === "organizing") return 3;
    if (s === "収束" || lower === "converging") return 4;
    if (s === "決定" || lower === "deciding") return 5;
  }

  return null;
}

function normalizeRequiredAssistantText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("authenticatedState: assistantText is required");
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error("authenticatedState: assistantText is required");
  }

  return normalized;
}

function normalizeRequiredPhase1to5(
  value: unknown,
  fieldName: string,
): 1 | 2 | 3 | 4 | 5 {
  const normalized = normalizeConfirmedStateLevel(value);

  if (!isPhase1to5(normalized)) {
    throw new Error(`authenticatedState: ${fieldName} must be 1..5`);
  }

  return normalized;
}

function normalizeRequiredBoolean(
  value: unknown,
  fieldName: string,
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`authenticatedState: ${fieldName} is required`);
  }

  return value;
}

function normalizeOptionalCompassValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function buildCanonicalAssistantState(params: {
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
  prevPhase: 1 | 2 | 3 | 4 | 5;
  prevStateLevel: 1 | 2 | 3 | 4 | 5;
}): CanonicalAssistantState {
  const {
    currentPhase,
    currentStateLevel,
    stateChanged,
    prevPhase,
    prevStateLevel,
  } = params;

  return {
    current_phase: currentPhase,
    state_level: currentStateLevel,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    state_changed: stateChanged,
  };
}

export function buildConfirmedAssistantTurn(params: {
  assistantText: string;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
  prevPhase: 1 | 2 | 3 | 4 | 5;
  prevStateLevel: 1 | 2 | 3 | 4 | 5;
  compassText?: string | null;
  compassPrompt?: string | null;
}): ConfirmedAssistantTurn {
  const assistantText = normalizeRequiredAssistantText(params.assistantText);
  const currentPhase = normalizeRequiredPhase1to5(
    params.currentPhase,
    "currentPhase",
  );
  const currentStateLevel = normalizeRequiredPhase1to5(
    params.currentStateLevel,
    "currentStateLevel",
  );
  const stateChanged = normalizeRequiredBoolean(
    params.stateChanged,
    "stateChanged",
  );
  const prevPhase = normalizeRequiredPhase1to5(
    params.prevPhase,
    "prevPhase",
  );
  const prevStateLevel = normalizeRequiredPhase1to5(
    params.prevStateLevel,
    "prevStateLevel",
  );
  const compassText = normalizeOptionalCompassValue(params.compassText);
  const compassPrompt = normalizeOptionalCompassValue(params.compassPrompt);

  const canonicalAssistantState = buildCanonicalAssistantState({
    currentPhase,
    currentStateLevel,
    stateChanged,
    prevPhase,
    prevStateLevel,
  });

  const confirmedTurn: ConfirmedAssistantTurn = {
    assistantText,
    currentPhase,
    currentStateLevel,
    prevPhase,
    prevStateLevel,
    stateChanged,
    compassText,
    compassPrompt,
    canonicalAssistantState,
  };

  if (compassText) {
    confirmedTurn.compass = {
      text: compassText,
      prompt: compassPrompt ?? null,
    };
  }

  return confirmedTurn;
}

/*
このファイルの正式役割
authenticated の confirmed state / confirmed turn を正規化して確定するファイル。
assistant 回答に対応する state を 1..5 / 5段階で固定し、
confirmedTurn と canonicalAssistantState を組み立てる。
このファイルは、未確定の state を後段へ流さないための入口である。
*/

/*
【今回このファイルで修正したこと】
- buildConfirmedAssistantTurn で compassText / compassPrompt だけでなく、正式shapeの confirmedTurn.compass も組み立てるようにしました。
- compassText が存在する場合だけ、confirmedTurn.compass.text / prompt を載せるようにしました。
- state の 1..5 固定、assistantText 必須、stateChanged 必須の既存正規化ロジックは変えていません。
*/
// このファイルの正式役割: authenticated の confirmed state / confirmed turn を確定するファイル