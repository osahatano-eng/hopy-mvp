/* /app/api/chat/_lib/threadMemory/mergeThreadMemory.ts */

import {
  hasThreadMemoryDraftContent,
  type HopyThreadMemoryDraft,
  type HopyThreadMemoryStateLevel,
} from "./buildThreadMemoryDraft";

export type HopyThreadMemory = {
  conversationId: string | null;
  topic: string | null;
  recentFlowSummary: string | null;
  currentGoal: string | null;
  latestUserIntent: string | null;
  latestAssistantDirection: string | null;
  decidedPoints: string[];
  unresolvedPoints: string[];
  sourceAssistantMessageId: string | null;
  sourceTurnIndex: number | null;
  lastConfirmedStateLevel: HopyThreadMemoryStateLevel | null;
  lastConfirmedPhase: HopyThreadMemoryStateLevel | null;
  updatedAt: string;
};

export type MergeThreadMemoryParams = {
  current?: HopyThreadMemory | null;
  draft?: HopyThreadMemoryDraft | null;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableText(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeUniqueLines(
  values: Array<string | null | undefined> | null | undefined,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    const normalized = normalizeText(value);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  const normalized = Math.trunc(value);
  return normalized >= 0 ? normalized : null;
}

function normalizeStateLevel(
  value: unknown,
): HopyThreadMemoryStateLevel | null {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }

  return null;
}

function normalizeUpdatedAt(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }

  return new Date().toISOString();
}

function mergeTextField(
  draftValue: unknown,
  currentValue: unknown,
): string | null {
  const draftText = normalizeNullableText(draftValue);
  if (draftText) return draftText;

  return normalizeNullableText(currentValue);
}

function mergeListField(
  draftValues: Array<string | null | undefined> | null | undefined,
  currentValues: Array<string | null | undefined> | null | undefined,
): string[] {
  const normalizedDraft = normalizeUniqueLines(draftValues);
  if (normalizedDraft.length > 0) return normalizedDraft;

  return normalizeUniqueLines(currentValues);
}

function buildFallbackRecentFlowSummary(input: {
  topic?: string | null;
  currentGoal?: string | null;
  latestUserIntent?: string | null;
  latestAssistantDirection?: string | null;
}): string | null {
  const parts: string[] = [];

  if (input.topic) {
    parts.push(`主題: ${input.topic}`);
  }

  if (input.currentGoal) {
    parts.push(`目的: ${input.currentGoal}`);
  }

  if (input.latestUserIntent) {
    parts.push(`直近要求: ${input.latestUserIntent}`);
  }

  if (input.latestAssistantDirection) {
    parts.push(`直近方向: ${input.latestAssistantDirection}`);
  }

  return parts.length > 0 ? parts.join(" / ") : null;
}

function hasDraftFlowSignal(draft: HopyThreadMemoryDraft | null): boolean {
  if (!draft) return false;

  return Boolean(
    draft.topic ||
      draft.currentGoal ||
      draft.latestUserIntent ||
      draft.latestAssistantDirection ||
      draft.decidedPoints.length > 0 ||
      draft.unresolvedPoints.length > 0,
  );
}

function resolveRecentFlowSummary(params: {
  current: HopyThreadMemory | null;
  draft: HopyThreadMemoryDraft | null;
  topic: string | null;
  currentGoal: string | null;
  latestUserIntent: string | null;
  latestAssistantDirection: string | null;
}): string | null {
  const explicitDraftSummary = normalizeNullableText(
    params.draft?.recentFlowSummary,
  );
  if (explicitDraftSummary) {
    return explicitDraftSummary;
  }

  if (hasDraftFlowSignal(params.draft)) {
    return buildFallbackRecentFlowSummary({
      topic: params.topic,
      currentGoal: params.currentGoal,
      latestUserIntent: params.latestUserIntent,
      latestAssistantDirection: params.latestAssistantDirection,
    });
  }

  const currentSummary = normalizeNullableText(params.current?.recentFlowSummary);
  if (currentSummary) {
    return currentSummary;
  }

  return buildFallbackRecentFlowSummary({
    topic: params.topic,
    currentGoal: params.currentGoal,
    latestUserIntent: params.latestUserIntent,
    latestAssistantDirection: params.latestAssistantDirection,
  });
}

export function mergeThreadMemory(
  params: MergeThreadMemoryParams,
): HopyThreadMemory {
  const current = params.current ?? null;
  const draft = params.draft ?? null;

  const topic = mergeTextField(draft?.topic, current?.topic);
  const currentGoal = mergeTextField(draft?.currentGoal, current?.currentGoal);
  const latestUserIntent = mergeTextField(
    draft?.latestUserIntent,
    current?.latestUserIntent,
  );
  const latestAssistantDirection = mergeTextField(
    draft?.latestAssistantDirection,
    current?.latestAssistantDirection,
  );
  const decidedPoints = mergeListField(
    draft?.decidedPoints,
    current?.decidedPoints,
  );
  const unresolvedPoints = mergeListField(
    draft?.unresolvedPoints,
    current?.unresolvedPoints,
  );

  return {
    conversationId: mergeTextField(draft?.conversationId, current?.conversationId),
    topic,
    recentFlowSummary: resolveRecentFlowSummary({
      current,
      draft,
      topic,
      currentGoal,
      latestUserIntent,
      latestAssistantDirection,
    }),
    currentGoal,
    latestUserIntent,
    latestAssistantDirection,
    decidedPoints,
    unresolvedPoints,
    sourceAssistantMessageId: mergeTextField(
      draft?.sourceAssistantMessageId,
      current?.sourceAssistantMessageId,
    ),
    sourceTurnIndex:
      normalizePositiveInteger(draft?.sourceTurnIndex) ??
      normalizePositiveInteger(current?.sourceTurnIndex),
    lastConfirmedStateLevel:
      normalizeStateLevel(draft?.lastConfirmedStateLevel) ??
      normalizeStateLevel(current?.lastConfirmedStateLevel),
    lastConfirmedPhase:
      normalizeStateLevel(draft?.lastConfirmedPhase) ??
      normalizeStateLevel(current?.lastConfirmedPhase),
    updatedAt: hasThreadMemoryDraftContent(draft)
      ? normalizeUpdatedAt(draft?.updatedAt)
      : normalizeUpdatedAt(current?.updatedAt),
  };
}

export function hasThreadMemoryContent(
  memory: HopyThreadMemory | null | undefined,
): boolean {
  if (!memory) return false;

  return Boolean(
    memory.topic ||
      memory.recentFlowSummary ||
      memory.currentGoal ||
      memory.latestUserIntent ||
      memory.latestAssistantDirection ||
      memory.decidedPoints.length > 0 ||
      memory.unresolvedPoints.length > 0,
  );
}

/*
このファイルの正式役割
既存の thread memory と、今回ターンで作られた draft を統合して、最新の thread memory を返すファイル。
prompt生成、DB保存、復元、stateの再判定は担当しない。
*/

/*
【今回このファイルで修正したこと】
- チャット内流れ記憶の「更新する役」を新規ファイルとして分離しました。
- 既存 thread memory と draft を統合する mergeThreadMemory を追加しました。
- topic / currentGoal / latestUserIntent / latestAssistantDirection は draft 優先、未指定時は既存維持に固定しました。
- decidedPoints / unresolvedPoints は重複除去つきで統合し、draft が空なら既存維持に固定しました。
- recentFlowSummary は draft 明示値を優先し、必要時だけ最小要約を再構成する形にしました。
- state は 1..5 / 5段階の参照写しだけを保持し、再判定しない形に固定しました。
- prompt生成、DB保存、復元処理には触っていません。
*/

/* /app/api/chat/_lib/threadMemory/mergeThreadMemory.ts */