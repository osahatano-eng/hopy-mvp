// /app/api/chat/_lib/route/authenticatedPostTurnMemoryCandidates.ts

import type { Lang } from "../router/simpleRouter";
import type { ConfirmedMemoryCandidate } from "./authenticatedHelpers";
import { resolveFinalConfirmedMemoryCandidates } from "./authenticatedMemoryCandidates";

type RunHopyTurnBuiltResult = Record<string, any>;
type ResolvedPlan = "free" | "plus" | "pro";
type ResolveFinalConfirmedMemoryCandidatesArgs = Parameters<
  typeof resolveFinalConfirmedMemoryCandidates
>[0];

type ConfirmedMemoryCandidatesTurn =
  ResolveFinalConfirmedMemoryCandidatesArgs["confirmedTurn"];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toConfirmedMemoryCandidates(
  value: unknown,
): ConfirmedMemoryCandidate[] {
  if (!Array.isArray(value)) return [];

  return value.filter((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    const content =
      typeof record.content === "string"
        ? record.content.trim()
        : typeof record.body === "string"
          ? record.body.trim()
          : "";
    return content.length > 0;
  }) as ConfirmedMemoryCandidate[];
}

function resolveBuiltResultConfirmedMemoryCandidates(
  runTurnResult: RunHopyTurnBuiltResult | null | undefined,
): ConfirmedMemoryCandidate[] {
  const topLevelConfirmed = toConfirmedMemoryCandidates(
    runTurnResult?.confirmed_memory_candidates,
  );
  if (topLevelConfirmed.length > 0) {
    return topLevelConfirmed;
  }

  const topLevelMemory = toConfirmedMemoryCandidates(
    runTurnResult?.memory_candidates,
  );
  if (topLevelMemory.length > 0) {
    return topLevelMemory;
  }

  const confirmedPayload = asRecord(runTurnResult?.hopy_confirmed_payload);
  if (!confirmedPayload) {
    return [];
  }

  const payloadConfirmed = toConfirmedMemoryCandidates(
    confirmedPayload.confirmed_memory_candidates,
  );
  if (payloadConfirmed.length > 0) {
    return payloadConfirmed;
  }

  const payloadMemory = toConfirmedMemoryCandidates(
    confirmedPayload.memory_candidates,
  );
  if (payloadMemory.length > 0) {
    return payloadMemory;
  }

  return [];
}

export async function resolveConfirmedMemoryCandidatesWithTimeout(params: {
  runTurnResult: RunHopyTurnBuiltResult | null | undefined;
  resolvedPlan: ResolvedPlan;
  userText: string;
  confirmedTurn: ConfirmedMemoryCandidatesTurn;
  uiLang: Lang;
  resolvedConversationId: string;
  assistantMessageId: string;
  usedHeuristicConfirmedMemoryCandidates: boolean;
  timeoutMs: number;
}): Promise<{
  confirmedMemoryCandidates: ConfirmedMemoryCandidate[];
  usedHeuristicConfirmedMemoryCandidates: boolean;
}> {
  const builtResultConfirmedMemoryCandidates =
    resolveBuiltResultConfirmedMemoryCandidates(params.runTurnResult);

  if (builtResultConfirmedMemoryCandidates.length > 0) {
    return {
      confirmedMemoryCandidates: builtResultConfirmedMemoryCandidates,
      usedHeuristicConfirmedMemoryCandidates:
        params.usedHeuristicConfirmedMemoryCandidates,
    };
  }

  const safeTimeoutMs =
    Number.isFinite(params.timeoutMs) && params.timeoutMs > 0
      ? Math.floor(params.timeoutMs)
      : 1500;

  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const resolved = await Promise.race([
      resolveFinalConfirmedMemoryCandidates({
        result: params.runTurnResult,
        resolvedPlan: params.resolvedPlan,
        userText: params.userText,
        confirmedTurn: params.confirmedTurn,
        uiLang: params.uiLang,
        resolvedConversationId: params.resolvedConversationId,
        assistantMessageId: params.assistantMessageId,
      }),
      new Promise<{
        confirmedMemoryCandidates: ConfirmedMemoryCandidate[];
        usedHeuristicConfirmedMemoryCandidates: boolean;
      }>((resolve) => {
        timer = setTimeout(() => {
          resolve({
            confirmedMemoryCandidates: [],
            usedHeuristicConfirmedMemoryCandidates:
              params.usedHeuristicConfirmedMemoryCandidates,
          });
        }, safeTimeoutMs);
      }),
    ]);

    return resolved;
  } catch {
    return {
      confirmedMemoryCandidates: [],
      usedHeuristicConfirmedMemoryCandidates:
        params.usedHeuristicConfirmedMemoryCandidates,
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/*
【このファイルの正式役割】
authenticated postTurn の confirmed memory candidates 解決責務だけを持つ。
runTurnResult / hopy_confirmed_payload から confirmed memory candidates を抽出し、
存在しない場合だけ resolveFinalConfirmedMemoryCandidates(...) を timeout 付きで呼び出す。
このファイルは memory candidates の解決だけを担当し、
memory 書き込み実行、state_changed、state_level、current_phase、Compass、HOPY回答○、
learning、audit、thread_summary、title 解決、Future Chain は再判定しない。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から分離するため、
  confirmed memory candidates 解決責務を新規ファイルとして作成した。
- toConfirmedMemoryCandidates(...) を移せる形で定義した。
- resolveBuiltResultConfirmedMemoryCandidates(...) を移せる形で定義した。
- resolveConfirmedMemoryCandidatesWithTimeout(...) を移せる形で定義した。
- resolveFinalConfirmedMemoryCandidates の import を親ファイルから移せる形にした。
- HOPY唯一の正、Compass、memory 書き込み実行、learning、audit、thread_summary、
  title 解決、Future Chain には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnMemoryCandidates.ts
*/