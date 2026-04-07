// /app/api/chat/_lib/route/authenticatedFinalize.ts

import type { NotificationState } from "../state/notification";
import {
  buildDashboardSignal,
  buildSupportFocusSignal,
} from "./dashboardSignal";
import { buildConfirmedMeaningPayload } from "./hopyConfirmedPayload/buildConfirmedMeaningPayload";
import {
  buildAuthenticatedChatPayload,
  buildConfirmedAssistantTurn,
} from "./authenticatedHelpers";
import type { ConfirmedMemoryCandidate } from "./authenticatedHelpers";
import { handleMemoryClean } from "./memoryClean";

type ConfirmedAssistantTurn = ReturnType<typeof buildConfirmedAssistantTurn>;
type ConfirmedMeaningPayload = ReturnType<typeof buildConfirmedMeaningPayload>;
type MemoryWriteDebug =
  Parameters<typeof buildConfirmedMeaningPayload>[0]["memoryWrite"];
type AuthenticatedChatPayload = ReturnType<typeof buildAuthenticatedChatPayload>;
type ResponseConfirmedPayload = NonNullable<
  AuthenticatedChatPayload["hopy_confirmed_payload"]
>;

export type FinalizedTurnArtifacts = {
  confirmedTurn: ConfirmedAssistantTurn;
  notification: NotificationState;
  confirmedMeaningPayload: ConfirmedMeaningPayload;
  compassText: string | null;
  compassPrompt: string | null;
};

export type BuildAuthenticatedResponsePayloadParams = {
  finalizedTurnArtifacts: FinalizedTurnArtifacts;
  resolvedConversationId: string;
  threadTitleForPayload: string;
  stateUpdateOk: boolean;
  stateUpdateError: string | null;
  debugSave: boolean;
  server_created_thread: boolean;
  server_created_client_request_id: string | null;
  cleanTrigger: boolean;
  memory_clean: Awaited<ReturnType<typeof handleMemoryClean>>;
};

function normalizeCompassString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveConfirmedTurnCompassText(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  const source = confirmedTurn as ConfirmedAssistantTurn & {
    compassText?: unknown;
    compass_text?: unknown;
    compass?: {
      text?: unknown;
    } | null;
  };

  return (
    normalizeCompassString(source.compassText) ??
    normalizeCompassString(source.compass_text) ??
    normalizeCompassString(source.compass?.text)
  );
}

function resolveConfirmedTurnCompassPrompt(
  confirmedTurn: ConfirmedAssistantTurn,
): string | null {
  const source = confirmedTurn as ConfirmedAssistantTurn & {
    compassPrompt?: unknown;
    compass_prompt?: unknown;
    compass?: {
      prompt?: unknown;
    } | null;
  };

  return (
    normalizeCompassString(source.compassPrompt) ??
    normalizeCompassString(source.compass_prompt) ??
    normalizeCompassString(source.compass?.prompt)
  );
}

export function buildFinalizedTurnArtifacts(params: {
  confirmedTurn: ConfirmedAssistantTurn;
  notification: NotificationState;
  resolvedConversationId: string;
  assistantMessageId: string;
  latestReplyAt: string;
  autoTitleUpdated: boolean;
  memoryWrite: MemoryWriteDebug;
  confirmedMemoryCandidates: ConfirmedMemoryCandidate[];
  compassText?: unknown;
  compassPrompt?: unknown;
}): FinalizedTurnArtifacts {
  const {
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
  } = params;

  const dashboardSignal = buildDashboardSignal({
    assistantText: confirmedTurn.assistantText,
    currentPhase: confirmedTurn.currentPhase,
    stateLevel: confirmedTurn.currentStateLevel,
    stateChanged: confirmedTurn.stateChanged,
    prevPhase: confirmedTurn.prevPhase,
    prevStateLevel: confirmedTurn.prevStateLevel,
  });

  const supportFocusSignal = buildSupportFocusSignal({
    assistantText: confirmedTurn.assistantText,
    currentPhase: confirmedTurn.currentPhase,
    stateLevel: confirmedTurn.currentStateLevel,
    stateChanged: confirmedTurn.stateChanged,
    prevPhase: confirmedTurn.prevPhase,
    prevStateLevel: confirmedTurn.prevStateLevel,
  });

  const finalizedCompassText =
    normalizeCompassString(compassText) ??
    resolveConfirmedTurnCompassText(confirmedTurn);

  const finalizedCompassPrompt =
    normalizeCompassString(compassPrompt) ??
    resolveConfirmedTurnCompassPrompt(confirmedTurn);

  const confirmedMeaningPayload = buildConfirmedMeaningPayload({
    confirmedTurn,
    resolvedConversationId,
    assistantMessageId,
    latestReplyAt,
    autoTitleUpdated,
    notification,
    dashboardSignal,
    supportFocusSignal,
    memoryWrite,
    confirmedMemoryCandidates,
    compassText: finalizedCompassText,
    compassPrompt: finalizedCompassPrompt,
  });

  return {
    confirmedTurn,
    notification,
    confirmedMeaningPayload,
    compassText: finalizedCompassText,
    compassPrompt: finalizedCompassPrompt,
  };
}

export function buildAuthenticatedResponsePayload(
  params: BuildAuthenticatedResponsePayloadParams,
) {
  const {
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
  } = params;

  const payload = buildAuthenticatedChatPayload({
    confirmedTurn: finalizedTurnArtifacts.confirmedTurn,
    notification: finalizedTurnArtifacts.notification,
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

  delete (payload as { compass?: unknown }).compass;

  payload.hopy_confirmed_payload =
    finalizedTurnArtifacts.confirmedMeaningPayload as ResponseConfirmedPayload;

  return payload;
}

/*
このファイルの正式役割
authenticated 経路の最終 artifacts / payload 組み立てファイル。
confirmedTurn と notification と Compass 情報を受け取り、
confirmedMeaningPayload を作成し、
最終 API payload に hopy_confirmed_payload を載せる。

このファイルが受け取るもの
buildFinalizedTurnArtifacts(...) へ
- confirmedTurn
- notification
- resolvedConversationId
- assistantMessageId
- latestReplyAt
- autoTitleUpdated
- memoryWrite
- confirmedMemoryCandidates
- compassText
- compassPrompt

buildAuthenticatedResponsePayload(...) へ
- finalizedTurnArtifacts
- resolvedConversationId
- threadTitleForPayload
- stateUpdateOk
- stateUpdateError
- debugSave
- server_created_thread
- server_created_client_request_id
- cleanTrigger
- memory_clean

このファイルが渡すもの
FinalizedTurnArtifacts
- confirmedTurn
- notification
- confirmedMeaningPayload
- compassText
- compassPrompt

最終 payload
- buildAuthenticatedChatPayload(...) の結果
- payload.hopy_confirmed_payload

Compass 観点でこのファイルの意味
このファイルは Compass の最終中継箇所。
Compass を新規生成しない。
stateChanged を見て Compass を再判定しない。
受け取った compassText / compassPrompt を
confirmedMeaningPayload 側へ載せる。

このファイルで確認できた大事なこと
1. buildFinalizedTurnArtifacts(...) では、compassText 引数があればそれを優先し、なければ confirmedTurn 側の compassText を使う。
2. buildConfirmedMeaningPayload(...) に compassText / compassPrompt を渡している。
3. buildAuthenticatedResponsePayload(...) では top-level compass を載せず、hopy_confirmed_payload を唯一の正として返す。
4. このファイルは Compass の生成元ではなく、唯一の正へ載せるための最終中継である。
*/

/* 【今回このファイルで修正したこと】
- buildAuthenticatedResponsePayload(...) で top-level payload.compass を載せる処理をやめました。
- 念のため delete (payload as { compass?: unknown }).compass; を入れ、top-level compass が残らないようにしました。
- Compass の正は hopy_confirmed_payload 側だけに残す形へ寄せました。
- confirmedMeaningPayload の生成、state 値の計算、DB 保存処理には触れていません。
*/

/* /app/api/chat/_lib/route/authenticatedFinalize.ts */
// このファイルの正式役割: authenticated 経路の最終 artifacts / payload 組み立て