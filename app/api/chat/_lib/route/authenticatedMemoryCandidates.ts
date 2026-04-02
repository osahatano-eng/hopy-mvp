// /app/api/chat/_lib/route/authenticatedMemoryCandidates.ts

import type { Lang } from "../router/simpleRouter";
import type {
  AuthenticatedModelOutput,
  ConfirmedAssistantTurn,
} from "./authenticatedTypes";
import type { ResolvedPlan } from "./promptBundle";

type RunHopyTurnBuiltResult = Record<string, unknown>;

export type ConfirmedMemoryCandidate = {
  source_type: "auto" | "manual";
  memory_type:
    | "trait"
    | "theme"
    | "support_context"
    | "dashboard_signal"
    | "manual_note";
  body: string;
  savable: boolean;
  thread_id: string | null;
  source_message_id: string | null;
};

const PENDING_ASSISTANT_SOURCE_MESSAGE_ID =
  "__pending_assistant_message_id__";

function normalizeConfirmedMemorySourceType(
  value: unknown,
): "auto" | "manual" {
  return String(value ?? "").trim() === "manual" ? "manual" : "auto";
}

function normalizeConfirmedMemoryType(
  value: unknown,
):
  | "trait"
  | "theme"
  | "support_context"
  | "dashboard_signal"
  | "manual_note"
  | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "trait" ||
    normalized === "theme" ||
    normalized === "support_context" ||
    normalized === "dashboard_signal" ||
    normalized === "manual_note"
  ) {
    return normalized;
  }
  return null;
}

function normalizeConfirmedMemoryBody(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeConfirmedMemorySavable(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (
      s === "1" ||
      s === "true" ||
      s === "yes" ||
      s === "y" ||
      s === "ok" ||
      s === "save" ||
      s === "savable" ||
      s === "allowed"
    ) {
      return true;
    }
    if (
      s === "0" ||
      s === "false" ||
      s === "no" ||
      s === "n" ||
      s === "ng" ||
      s === "skip" ||
      s === "unsavable" ||
      s === "blocked"
    ) {
      return false;
    }
  }
  return false;
}

function normalizeConfirmedMemoryId(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function readConfirmedMemoryBody(raw: any): string {
  return normalizeConfirmedMemoryBody(
    raw?.body ??
      raw?.text ??
      raw?.content ??
      raw?.summary ??
      raw?.memory_body ??
      raw?.memory_text,
  );
}

function readConfirmedMemoryType(
  raw: any,
): ConfirmedMemoryCandidate["memory_type"] | null {
  return normalizeConfirmedMemoryType(
    raw?.memory_type ?? raw?.type ?? raw?.memoryType ?? raw?.category,
  );
}

function readConfirmedMemorySourceType(raw: any): "auto" | "manual" {
  return normalizeConfirmedMemorySourceType(
    raw?.source_type ?? raw?.sourceType ?? raw?.source,
  );
}

function readConfirmedMemorySavable(raw: any): boolean {
  const explicit =
    raw?.savable ??
    raw?.save_hint ??
    raw?.should_save ??
    raw?.shouldSave;

  if (explicit !== undefined) {
    return normalizeConfirmedMemorySavable(explicit);
  }

  return true;
}

export function normalizeConfirmedMemoryCandidates(
  value: unknown,
): ConfirmedMemoryCandidate[] {
  if (!Array.isArray(value)) return [];

  const out: ConfirmedMemoryCandidate[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;

    const body = readConfirmedMemoryBody(raw as any);
    const memory_type = readConfirmedMemoryType(raw as any);
    if (!body || !memory_type) continue;

    const source_type = readConfirmedMemorySourceType(raw as any);
    const savable = readConfirmedMemorySavable(raw as any);
    const thread_id = normalizeConfirmedMemoryId(
      (raw as any).thread_id ??
        (raw as any).source_thread_id ??
        (raw as any).threadId ??
        (raw as any).sourceThreadId,
    );
    const source_message_id = normalizeConfirmedMemoryId(
      (raw as any).source_message_id ??
        (raw as any).latest_reply_id ??
        (raw as any).message_id ??
        (raw as any).sourceMessageId ??
        (raw as any).reply_id,
    );

    const key = `${source_type}::${memory_type}::${body}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      source_type,
      memory_type,
      body,
      savable,
      thread_id,
      source_message_id,
    });
  }

  return out;
}

function buildConfirmedMemoryCandidateKey(
  candidate: ConfirmedMemoryCandidate,
): string {
  const memoryType = String(candidate?.memory_type ?? "").trim().toLowerCase();
  const body = String(candidate?.body ?? "").trim().replace(/\s+/g, " ");
  const sourceType = String(candidate?.source_type ?? "auto")
    .trim()
    .toLowerCase();

  return [memoryType, body, sourceType].join("::");
}

export function mergeConfirmedMemoryCandidates(
  ...groups: Array<ConfirmedMemoryCandidate[]>
): ConfirmedMemoryCandidate[] {
  const merged: ConfirmedMemoryCandidate[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const candidate of normalizeConfirmedMemoryCandidates(group ?? [])) {
      const key = buildConfirmedMemoryCandidateKey(candidate);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(candidate);
    }
  }

  return merged;
}

function coerceHeuristicCandidate(
  item: unknown,
  fallbackThreadId: string,
): ConfirmedMemoryCandidate | null {
  if (!item || typeof item !== "object") return null;

  const raw = item as Record<string, unknown>;

  const memoryType =
    normalizeConfirmedMemoryType(
      raw.memory_type ?? raw.type ?? raw.kind ?? raw.category,
    ) ?? "support_context";

  const body = String(
    raw.body ?? raw.summary ?? raw.text ?? raw.content ?? "",
  ).trim();

  if (!body) return null;

  const sourceType =
    String(raw.source_type ?? raw.sourceType ?? "auto").trim() || "auto";

  const sourceMessageId = String(
    raw.source_message_id ??
      raw.sourceMessageId ??
      raw.latest_reply_id ??
      raw.latestReplyId ??
      PENDING_ASSISTANT_SOURCE_MESSAGE_ID,
  ).trim();

  const threadId = String(
    raw.thread_id ?? raw.threadId ?? fallbackThreadId,
  ).trim();

  const savableRaw = raw.savable ?? raw.save_hint ?? raw.saveHint;
  const savable =
    typeof savableRaw === "boolean"
      ? savableRaw
      : String(savableRaw ?? "").trim().toLowerCase() !== "false";

  return {
    memory_type: memoryType,
    body,
    source_type: sourceType === "manual" ? "manual" : "auto",
    thread_id: threadId || fallbackThreadId,
    source_message_id: sourceMessageId || PENDING_ASSISTANT_SOURCE_MESSAGE_ID,
    savable,
  };
}

export async function resolveHeuristicConfirmedMemoryCandidatesForTurn(params: {
  userText: string;
  assistantText: string;
  currentStateLevel: number;
  currentPhase: number;
  uiLang: Lang;
  resolvedConversationId: string;
}): Promise<ConfirmedMemoryCandidate[]> {
  try {
    const mod = (await import("../memory/heuristic")) as any;
    const extractHeuristicMemories = mod?.extractHeuristicMemories;

    if (typeof extractHeuristicMemories !== "function") {
      return [];
    }

    const attempts = [
      () =>
        extractHeuristicMemories({
          uiLang: params.uiLang,
          userText: params.userText,
          assistantText: params.assistantText,
          maxItems: 2,
        }),
      () =>
        extractHeuristicMemories({
          uiLang: params.uiLang,
          userText: params.userText,
          assistantText: "",
          maxItems: 2,
        }),
    ];

    for (const attempt of attempts) {
      try {
        const raw = await attempt();
        if (!Array.isArray(raw) || raw.length <= 0) continue;

        const mapped = raw
          .map((item) =>
            coerceHeuristicCandidate(item, params.resolvedConversationId),
          )
          .filter(Boolean) as ConfirmedMemoryCandidate[];

        if (mapped.length > 0) {
          return normalizeConfirmedMemoryCandidates(mapped);
        }
      } catch {
        continue;
      }
    }

    return [];
  } catch {
    return [];
  }
}

function buildInterpretedFallbackConfirmedMemoryCandidates(params: {
  userText: string;
  resolvedConversationId: string;
  assistantMessageId: string;
  uiLang: Lang;
}): ConfirmedMemoryCandidate[] {
  const normalized = String(params.userText ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) return [];

  const truncated =
    normalized.length > 120 ? `${normalized.slice(0, 120).trim()}…` : normalized;

  const body =
    params.uiLang === "ja"
      ? `ユーザーは「${truncated}」について整理や確認を求めている`
      : `The user is seeking help organizing or clarifying: "${truncated}"`;

  return [
    {
      source_type: "auto",
      memory_type: "support_context",
      body,
      savable: true,
      thread_id: params.resolvedConversationId,
      source_message_id: params.assistantMessageId,
    },
  ];
}

function applyConfirmedMemoryCandidateFallback(params: {
  candidates: ConfirmedMemoryCandidate[];
  threadId?: string;
  sourceMessageId?: string;
}): ConfirmedMemoryCandidate[] {
  if (!params.threadId && !params.sourceMessageId) {
    return params.candidates;
  }

  return params.candidates.map((candidate) => {
    const rawCandidate = candidate as any;

    const resolvedThreadId = String(
      rawCandidate?.thread_id ?? params.threadId ?? "",
    ).trim();

    const rawSourceMessageId = String(
      rawCandidate?.source_message_id ??
        rawCandidate?.latest_reply_id ??
        params.sourceMessageId ??
        "",
    ).trim();

    const resolvedSourceMessageId =
      !rawSourceMessageId ||
      rawSourceMessageId === PENDING_ASSISTANT_SOURCE_MESSAGE_ID
        ? String(params.sourceMessageId ?? "").trim()
        : rawSourceMessageId;

    return {
      ...candidate,
      thread_id: resolvedThreadId || rawCandidate?.thread_id,
      source_message_id:
        resolvedSourceMessageId ||
        rawCandidate?.source_message_id ||
        params.sourceMessageId,
    };
  });
}

export function resolveConfirmedMemoryCandidatesFromBuiltResult(
  result: RunHopyTurnBuiltResult | null | undefined,
  fallback?: {
    threadId?: string;
    sourceMessageId?: string;
  },
): ConfirmedMemoryCandidate[] {
  if (!result || typeof result !== "object") return [];

  const rawResult = result as any;

  const normalized = normalizeConfirmedMemoryCandidates(
    rawResult?.confirmed_memory_candidates ??
      rawResult?.memory_candidates ??
      rawResult?.hopy_confirmed_payload?.memory_candidates ??
      rawResult?.turnRecord?.confirmed_memory_candidates ??
      [],
  );

  return applyConfirmedMemoryCandidateFallback({
    candidates: normalized,
    threadId: fallback?.threadId,
    sourceMessageId: fallback?.sourceMessageId,
  });
}

export function resolveConfirmedMemoryCandidatesForTurn(params: {
  body: any;
  modelOutput: AuthenticatedModelOutput;
}): ConfirmedMemoryCandidate[] {
  const rawBody = params.body as any;
  const rawModelOutput = params.modelOutput as any;

  return mergeConfirmedMemoryCandidates(
    rawModelOutput?.confirmed_memory_candidates ?? [],
    rawModelOutput?.memory_candidates ?? [],
    rawModelOutput?.hopy_confirmed_payload?.memory_candidates ?? [],
    rawBody?.confirmed_memory_candidates ?? [],
    rawBody?.memory_candidates ?? [],
    rawBody?.hopy_confirmed_payload?.memory_candidates ?? [],
  );
}

function resolveBuiltResultCandidatesWithFallback(params: {
  result: RunHopyTurnBuiltResult | null | undefined;
  resolvedConversationId: string;
  assistantMessageId: string;
}): ConfirmedMemoryCandidate[] {
  return resolveConfirmedMemoryCandidatesFromBuiltResult(params.result, {
    threadId: params.resolvedConversationId,
    sourceMessageId: params.assistantMessageId,
  });
}

function resolveHeuristicCandidatesWithFallback(params: {
  heuristicConfirmedMemoryCandidates: ConfirmedMemoryCandidate[];
  resolvedConversationId: string;
  assistantMessageId: string;
}): ConfirmedMemoryCandidate[] {
  return applyConfirmedMemoryCandidateFallback({
    candidates: normalizeConfirmedMemoryCandidates(
      params.heuristicConfirmedMemoryCandidates,
    ),
    threadId: params.resolvedConversationId,
    sourceMessageId: params.assistantMessageId,
  });
}

export async function resolveFinalConfirmedMemoryCandidates(params: {
  result: RunHopyTurnBuiltResult | null | undefined;
  resolvedPlan: ResolvedPlan;
  userText: string;
  confirmedTurn: ConfirmedAssistantTurn;
  uiLang: Lang;
  resolvedConversationId: string;
  assistantMessageId: string;
}): Promise<{
  confirmedMemoryCandidates: ConfirmedMemoryCandidate[];
  usedHeuristicConfirmedMemoryCandidates: boolean;
}> {
  const builtResultCandidates = resolveBuiltResultCandidatesWithFallback({
    result: params.result,
    resolvedConversationId: params.resolvedConversationId,
    assistantMessageId: params.assistantMessageId,
  });

  if (params.resolvedPlan !== "free") {
    return {
      confirmedMemoryCandidates: builtResultCandidates,
      usedHeuristicConfirmedMemoryCandidates: false,
    };
  }

  const heuristicConfirmedMemoryCandidates =
    await resolveHeuristicConfirmedMemoryCandidatesForTurn({
      userText: params.userText,
      assistantText: params.confirmedTurn.assistantText,
      currentStateLevel: params.confirmedTurn.currentStateLevel,
      currentPhase: params.confirmedTurn.currentPhase,
      uiLang: params.uiLang,
      resolvedConversationId: params.resolvedConversationId,
    });

  const resolvedHeuristicCandidates =
    heuristicConfirmedMemoryCandidates.length > 0
      ? resolveHeuristicCandidatesWithFallback({
          heuristicConfirmedMemoryCandidates,
          resolvedConversationId: params.resolvedConversationId,
          assistantMessageId: params.assistantMessageId,
        })
      : [];

  if (params.resolvedPlan === "free") {
    if (resolvedHeuristicCandidates.length > 0) {
      return {
        confirmedMemoryCandidates: resolvedHeuristicCandidates,
        usedHeuristicConfirmedMemoryCandidates: true,
      };
    }

    if (builtResultCandidates.length > 0) {
      return {
        confirmedMemoryCandidates: builtResultCandidates,
        usedHeuristicConfirmedMemoryCandidates: false,
      };
    }

    return {
      confirmedMemoryCandidates: buildInterpretedFallbackConfirmedMemoryCandidates(
        {
          userText: params.userText,
          resolvedConversationId: params.resolvedConversationId,
          assistantMessageId: params.assistantMessageId,
          uiLang: params.uiLang,
        },
      ),
      usedHeuristicConfirmedMemoryCandidates: false,
    };
  }

  if (builtResultCandidates.length > 0) {
    return {
      confirmedMemoryCandidates: builtResultCandidates,
      usedHeuristicConfirmedMemoryCandidates: false,
    };
  }

  if (resolvedHeuristicCandidates.length > 0) {
    return {
      confirmedMemoryCandidates: resolvedHeuristicCandidates,
      usedHeuristicConfirmedMemoryCandidates: true,
    };
  }

  return {
    confirmedMemoryCandidates: [],
    usedHeuristicConfirmedMemoryCandidates: false,
  };
}

/*
このファイルの正式役割
authenticated の memory candidates 解決ファイル。
runTurnResult / modelOutput / body から confirmed memory candidates を正規化し、
必要時のみ heuristic fallback を使って、最終 candidates を返す。
*/

/*
【今回このファイルで修正したこと】
- ./runHopyTurn から存在しない RunHopyTurnBuiltResult を import していた箇所を削除しました。
- このファイル内だけで使う最小のローカル型として RunHopyTurnBuiltResult = Record<string, unknown> を定義しました。
- result の中身はもともと any 経由で読んでいるため、既存の実行ロジックには触れていません。
- HOPY唯一の正である state / Compass 判定には触っていません。
*/
// このファイルの正式役割: authenticated の memory candidates 解決ファイル