// /app/api/chat/_lib/route/authenticatedPostTurnPayloadFinalizeFlow.ts

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildAuthenticatedResponsePayload,
  buildFinalizedTurnArtifacts,
} from "./authenticatedFinalize";
import {
  attachFutureChainDisplayToPayload,
} from "./authenticatedPostTurnFutureChainDisplay";
import { attachFutureChainPersistToPayload } from "./authenticatedPostTurnFutureChainPayload";
import { attachThreadSummarySaveDebugToPayload } from "./authenticatedPostTurnThreadSummarySave";
import { saveFutureChainDeliveryEventForPayload } from "../hopy/future-chain";

type BuildFinalizedTurnArtifactsInput = Parameters<
  typeof buildFinalizedTurnArtifacts
>[0];

type BuildAuthenticatedResponsePayloadInput = Parameters<
  typeof buildAuthenticatedResponsePayload
>[0];

type AttachThreadSummarySaveDebugInput = Parameters<
  typeof attachThreadSummarySaveDebugToPayload
>[0];

type ResolvedPlan = "free" | "plus" | "pro";

export type AuthenticatedPostTurnPayloadFinalizeFlowParams = {
  confirmedTurn: BuildFinalizedTurnArtifactsInput["confirmedTurn"];
  notification: BuildFinalizedTurnArtifactsInput["notification"];
  resolvedConversationId: string;
  assistantMessageId: string;
  latestReplyAt: string;
  autoTitleUpdated: boolean;
  memoryWrite: BuildFinalizedTurnArtifactsInput["memoryWrite"];
  confirmedMemoryCandidates: BuildFinalizedTurnArtifactsInput["confirmedMemoryCandidates"];
  compassText: BuildFinalizedTurnArtifactsInput["compassText"];
  compassPrompt: BuildFinalizedTurnArtifactsInput["compassPrompt"];
  futureChainContext?: BuildFinalizedTurnArtifactsInput["futureChainContext"];
  threadTitleForPayload: BuildAuthenticatedResponsePayloadInput["threadTitleForPayload"];
  stateUpdateOk: boolean;
  stateUpdateError: string | null;
  debugSave: boolean;
  server_created_thread: boolean;
  server_created_client_request_id: string | null;
  cleanTrigger: boolean;
  memory_clean: any;
  runTurnResult: any;
  threadSummarySaveDebug: AttachThreadSummarySaveDebugInput["threadSummarySaveDebug"];
  supabase: SupabaseClient;
  resolvedPlan: ResolvedPlan;
  authedUserId?: string | null;
};

export type AuthenticatedPostTurnPayloadFinalizeFlowResult = {
  payload: any;
};

export async function finalizeAuthenticatedPostTurnPayloadFlow({
  confirmedTurn,
  notification,
  resolvedConversationId,
  assistantMessageId,
  latestReplyAt,
  autoTitleUpdated,
  memoryWrite,
  confirmedMemoryCandidates,
  compassText,
  compassPrompt,
  futureChainContext,
  threadTitleForPayload,
  stateUpdateOk,
  stateUpdateError,
  debugSave,
  server_created_thread,
  server_created_client_request_id,
  cleanTrigger,
  memory_clean,
  runTurnResult,
  threadSummarySaveDebug,
  supabase,
  resolvedPlan,
  authedUserId = null,
}: AuthenticatedPostTurnPayloadFinalizeFlowParams): Promise<AuthenticatedPostTurnPayloadFinalizeFlowResult> {
  const finalizedTurnArtifacts = buildFinalizedTurnArtifacts({
    confirmedTurn,
    notification,
    resolvedConversationId,
    assistantMessageId,
    latestReplyAt,
    autoTitleUpdated,
    memoryWrite,
    confirmedMemoryCandidates,
    compassText,
    compassPrompt,
    futureChainContext,
  });

  const payload = buildAuthenticatedResponsePayload({
    finalizedTurnArtifacts,
    resolvedConversationId,
    threadTitleForPayload,
    stateUpdateOk,
    stateUpdateError,
    debugSave,
    server_created_thread,
    server_created_client_request_id,
    cleanTrigger,
    memory_clean,
  });

  const payloadWithFutureChainPersist = attachFutureChainPersistToPayload({
    payload,
    runTurnResult,
  });

  const payloadWithFutureChainDisplay = await attachFutureChainDisplayToPayload({
    payload: payloadWithFutureChainPersist,
    supabase,
    resolvedPlan,
    recipientThreadId: resolvedConversationId,
  });

  await saveFutureChainDeliveryEventForPayload({
    supabase,
    payload: payloadWithFutureChainDisplay,
    recipientUserId: authedUserId,
    recipientThreadId: resolvedConversationId,
    recipientAssistantMessageId: assistantMessageId,
    recipientPlan: resolvedPlan,
  });

  const payloadWithThreadSummaryDebug = attachThreadSummarySaveDebugToPayload({
    payload: payloadWithFutureChainDisplay,
    debugSave,
    threadSummarySaveDebug,
  });

  return {
    payload: payloadWithThreadSummaryDebug,
  };
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn 最終化における最終payload組み立てフロー責務。
confirmedTurn、notification、memoryWrite、confirmedMemoryCandidates、
Compass 表示用値、Future Chain context、threadTitleForPayload、stateUpdate 結果、
Future Chain persist 情報、Future Chain display 情報、Future Chain delivery_event 保存、
threadSummarySaveDebug を受け取り、最終 payload を組み立てて返す。

このファイルは state_changed / state_level / current_phase / Compass を再判定しない。
このファイルは Future Chain の意味生成・カテゴリ生成・4項目生成をしない。
親から受け取った確定済み値を buildFinalizedTurnArtifacts(...)、
buildAuthenticatedResponsePayload(...)、
attachFutureChainPersistToPayload(...)、
attachFutureChainDisplayToPayload(...)、
saveFutureChainDeliveryEventForPayload(...)、
attachThreadSummarySaveDebugToPayload(...) へ渡すだけにする。

【今回このファイルで修正したこと】
- attachFutureChainDisplayToPayload(...) に recipientThreadId: resolvedConversationId を渡すようにしました。
- selectFutureChainRecipientSupport(...) 側で同一スレッドの表示済み bridge_event_id 除外が効く入口を接続しました。
- delivery_event保存helperへの recipientThreadId: resolvedConversationId の受け渡しは維持しました。
- このファイルでは Future Chain の意味生成・保存判定・候補選択・UI本体表示は入れていません。
- HOPY唯一の正、state_changed、Compass生成、HOPY回答○、Memory書き込み、
  Learning保存、thread_summary保存、audit、thread title、Future Chain保存仕様そのものには触れていません。

/app/api/chat/_lib/route/authenticatedPostTurnPayloadFinalizeFlow.ts
*/