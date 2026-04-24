// /app/api/chat/_lib/route/authenticatedPostTurnThreadSummaryResolve.ts

type RunHopyTurnBuiltResult = Record<string, any>;
type HopyStateLevel = 1 | 2 | 3 | 4 | 5;

type ConfirmedAssistantTurnForThreadSummary = {
  prevPhase: HopyStateLevel;
  prevStateLevel: HopyStateLevel;
  currentPhase: HopyStateLevel;
  currentStateLevel: HopyStateLevel;
  stateChanged: boolean;
  threadSummary?: string;
  thread_summary?: string;
};

export type ResolveAuthenticatedPostTurnThreadSummaryParams = {
  runTurnResult: RunHopyTurnBuiltResult | null | undefined;
  confirmedTurn: ConfirmedAssistantTurnForThreadSummary;
  resolvedConversationId: string;
  assistantMessageId: string;
  latestReplyAt: string;
  autoTitleUpdated: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeThreadSummary(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (value && typeof value === "object") {
    try {
      const serialized = JSON.stringify(value);
      if (typeof serialized !== "string") return null;

      const normalized = serialized.trim();
      return normalized.length > 0 ? normalized : null;
    } catch {
      return null;
    }
  }

  return null;
}

function buildCanonicalThreadSummaryRecord(params: {
  resolvedConversationId: string;
  assistantMessageId: string;
  latestReplyAt: string;
  confirmedTurn: ConfirmedAssistantTurnForThreadSummary;
  autoTitleUpdated: boolean;
}): Record<string, unknown> {
  return {
    thread_id: params.resolvedConversationId,
    latest_reply_id: params.assistantMessageId,
    latest_reply_at: params.latestReplyAt,
    latest_confirmed_state: {
      state_level: params.confirmedTurn.currentStateLevel,
      current_phase: params.confirmedTurn.currentPhase,
      prev_state_level: params.confirmedTurn.prevStateLevel,
      prev_phase: params.confirmedTurn.prevPhase,
      state_changed: params.confirmedTurn.stateChanged,
    },
    title_candidate_updated: params.autoTitleUpdated,
  };
}

export function resolveAuthenticatedPostTurnThreadSummary(
  params: ResolveAuthenticatedPostTurnThreadSummaryParams,
): string | null {
  const confirmedTurnSummary = normalizeThreadSummary(
    params.confirmedTurn.threadSummary ?? params.confirmedTurn.thread_summary,
  );
  if (confirmedTurnSummary !== null) {
    return confirmedTurnSummary;
  }

  const resultRecord = asRecord(params.runTurnResult ?? null);
  const confirmedPayload = asRecord(resultRecord?.hopy_confirmed_payload);

  const confirmedPayloadSummary = normalizeThreadSummary(
    confirmedPayload?.thread_summary ?? confirmedPayload?.threadSummary,
  );
  if (confirmedPayloadSummary !== null) {
    return confirmedPayloadSummary;
  }

  return normalizeThreadSummary(
    buildCanonicalThreadSummaryRecord({
      resolvedConversationId: params.resolvedConversationId,
      assistantMessageId: params.assistantMessageId,
      latestReplyAt: params.latestReplyAt,
      confirmedTurn: params.confirmedTurn,
      autoTitleUpdated: params.autoTitleUpdated,
    }),
  );
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn thread_summary 解決責務ファイル。
confirmedTurn / runTurnResult / thread 情報を受け取り、
保存対象にする confirmedThreadSummary を1つ返す。
採用順は、confirmedTurn の threadSummary、
hopy_confirmed_payload の thread_summary、
最後に canonical thread summary record の順とする。
このファイルは thread_summary の解決だけを担当し、
state_changed、state_level、current_phase、prev系、Compass、HOPY回答○を再判定しない。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から切り出すための
  thread_summary 解決責務を新規ファイルとして作成した。
- normalizeThreadSummary(...)、
  buildCanonicalThreadSummaryRecord(...)、
  resolveAuthenticatedPostTurnThreadSummary(...) を定義した。
- 既存の resolveConfirmedThreadSummary(...) と同じ採用順・同じ canonical record 形を維持した。
- 親ファイル接続はまだ行っていない。
- state_changed、Compass、HOPY回答○、memory、learning、audit、thread title、
  Future Chain、payload生成本体には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnThreadSummaryResolve.ts
*/