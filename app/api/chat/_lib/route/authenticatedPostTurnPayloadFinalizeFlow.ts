// /app/api/chat/_lib/route/authenticatedPostTurnPayloadFinalizeFlow.ts

import {
  buildAuthenticatedResponsePayload,
  buildFinalizedTurnArtifacts,
} from "./authenticatedFinalize";
import { attachFutureChainPersistToPayload } from "./authenticatedPostTurnFutureChainPayload";
import { attachThreadSummarySaveDebugToPayload } from "./authenticatedPostTurnThreadSummarySave";

type BuildFinalizedTurnArtifactsInput = Parameters<
  typeof buildFinalizedTurnArtifacts
>[0];

type BuildAuthenticatedResponsePayloadInput = Parameters<
  typeof buildAuthenticatedResponsePayload
>[0];

type AttachThreadSummarySaveDebugInput = Parameters<
  typeof attachThreadSummarySaveDebugToPayload
>[0];

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
};

export type AuthenticatedPostTurnPayloadFinalizeFlowResult = {
  payload: any;
};

export function finalizeAuthenticatedPostTurnPayloadFlow({
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
}: AuthenticatedPostTurnPayloadFinalizeFlowParams): AuthenticatedPostTurnPayloadFinalizeFlowResult {
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

  const payloadWithThreadSummaryDebug = attachThreadSummarySaveDebugToPayload({
    payload: payloadWithFutureChainPersist,
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
Future Chain persist 情報、threadSummarySaveDebug を受け取り、
最終 payload を組み立てて返す。

このファイルは state_changed / state_level / current_phase / Compass を再判定しない。
このファイルは Future Chain の意味生成・カテゴリ生成・4項目生成をしない。
親から受け取った確定済み値を buildFinalizedTurnArtifacts(...)、
buildAuthenticatedResponsePayload(...)、
attachFutureChainPersistToPayload(...)、
attachThreadSummarySaveDebugToPayload(...) へ渡すだけにする。

【今回このファイルで修正したこと】
- AuthenticatedPostTurnPayloadFinalizeFlowParams に futureChainContext を追加しました。
- finalizeAuthenticatedPostTurnPayloadFlow(...) で futureChainContext を受け取るようにしました。
- buildFinalizedTurnArtifacts(...) へ futureChainContext を渡すようにしました。
- Future Chain の意味生成・保存判定・DB保存・UI判定は入れていません。
- HOPY唯一の正、state_changed、Compass生成、HOPY回答○、Memory書き込み、
  Learning保存、thread_summary保存、audit、thread title、Future Chain保存仕様そのものには触れていません。

/app/api/chat/_lib/route/authenticatedPostTurnPayloadFinalizeFlow.ts
*/