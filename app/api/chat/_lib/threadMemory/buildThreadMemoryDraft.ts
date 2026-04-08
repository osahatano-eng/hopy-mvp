/* /app/api/chat/_lib/threadMemory/buildThreadMemoryDraft.ts */

export type HopyThreadMemoryStateLevel = 1 | 2 | 3 | 4 | 5;

export type HopyThreadMemoryMeaningInput = {
  topic?: string | null;
  recentFlowSummary?: string | null;
  currentGoal?: string | null;
  latestUserIntent?: string | null;
  latestAssistantDirection?: string | null;
  decidedPoints?: Array<string | null | undefined> | null;
  unresolvedPoints?: Array<string | null | undefined> | null;
};

export type BuildThreadMemoryDraftParams = {
  conversationId?: string | null;
  meaning?: HopyThreadMemoryMeaningInput | null;
  sourceAssistantMessageId?: string | null;
  sourceTurnIndex?: number | null;
  lastConfirmedStateLevel?: number | null;
  lastConfirmedPhase?: number | null;
  updatedAt?: string | Date | null;
};

export type HopyThreadMemoryDraft = {
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

function buildFallbackRecentFlowSummary(
  meaning: HopyThreadMemoryMeaningInput | null | undefined,
): string | null {
  const topic = normalizeNullableText(meaning?.topic);
  const currentGoal = normalizeNullableText(meaning?.currentGoal);
  const latestUserIntent = normalizeNullableText(meaning?.latestUserIntent);
  const latestAssistantDirection = normalizeNullableText(
    meaning?.latestAssistantDirection,
  );

  const parts: string[] = [];

  if (topic) {
    parts.push(`主題: ${topic}`);
  }

  if (currentGoal) {
    parts.push(`目的: ${currentGoal}`);
  }

  if (latestUserIntent) {
    parts.push(`直近要求: ${latestUserIntent}`);
  }

  if (latestAssistantDirection) {
    parts.push(`直近方向: ${latestAssistantDirection}`);
  }

  return parts.length > 0 ? parts.join(" / ") : null;
}

export function buildThreadMemoryDraft(
  params: BuildThreadMemoryDraftParams,
): HopyThreadMemoryDraft {
  const meaning = params.meaning ?? null;

  const recentFlowSummary =
    normalizeNullableText(meaning?.recentFlowSummary) ??
    buildFallbackRecentFlowSummary(meaning);

  return {
    conversationId: normalizeNullableText(params.conversationId),
    topic: normalizeNullableText(meaning?.topic),
    recentFlowSummary,
    currentGoal: normalizeNullableText(meaning?.currentGoal),
    latestUserIntent: normalizeNullableText(meaning?.latestUserIntent),
    latestAssistantDirection: normalizeNullableText(
      meaning?.latestAssistantDirection,
    ),
    decidedPoints: normalizeUniqueLines(meaning?.decidedPoints),
    unresolvedPoints: normalizeUniqueLines(meaning?.unresolvedPoints),
    sourceAssistantMessageId: normalizeNullableText(
      params.sourceAssistantMessageId,
    ),
    sourceTurnIndex: normalizePositiveInteger(params.sourceTurnIndex),
    lastConfirmedStateLevel: normalizeStateLevel(params.lastConfirmedStateLevel),
    lastConfirmedPhase: normalizeStateLevel(params.lastConfirmedPhase),
    updatedAt: normalizeUpdatedAt(params.updatedAt),
  };
}

export function hasThreadMemoryDraftContent(
  draft: HopyThreadMemoryDraft | null | undefined,
): boolean {
  if (!draft) return false;

  return Boolean(
    draft.topic ||
      draft.recentFlowSummary ||
      draft.currentGoal ||
      draft.latestUserIntent ||
      draft.latestAssistantDirection ||
      draft.decidedPoints.length > 0 ||
      draft.unresolvedPoints.length > 0,
  );
}

/*
このファイルの正式役割
assistant回答確定後の意味を受け取り、thread memory の更新材料だけを正規化して組み立てるファイル。
prompt生成、既存thread memoryとの統合、DB保存、stateの再判定は担当しない。
*/

/*
【今回このファイルで修正したこと】
- チャット内流れ記憶の「作る役」を新規ファイルとして分離しました。
- topic / recentFlowSummary / currentGoal / latestUserIntent / latestAssistantDirection / decidedPoints / unresolvedPoints を正規化して draft 化する buildThreadMemoryDraft を追加しました。
- state は 1..5 / 5段階の参照写しだけを保持し、再判定しない形に固定しました。
- draft に中身があるかだけを見る hasThreadMemoryDraftContent を追加しました。
- prompt生成、既存要約との統合、DB保存、復元処理には触っていません。
*/

/* /app/api/chat/_lib/threadMemory/buildThreadMemoryDraft.ts */