// /app/api/chat/_lib/route/authenticatedPayload.ts

import type { NotificationState } from "../state/notification";
import type {
  AuthenticatedChatPayload,
  ConfirmedAssistantTurn,
} from "./authenticatedTypes";

type Phase1to5 = 1 | 2 | 3 | 4 | 5;

function isPhase1to5(value: unknown): value is Phase1to5 {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function normalizeRequiredReply(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(
      "authenticatedPayload: confirmedTurn.assistantText is required",
    );
  }

  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(
      "authenticatedPayload: confirmedTurn.assistantText is required",
    );
  }

  return normalized;
}

function normalizeRequiredAssistantState(
  value: ConfirmedAssistantTurn["canonicalAssistantState"] | null | undefined,
): ConfirmedAssistantTurn["canonicalAssistantState"] {
  if (!value || typeof value !== "object") {
    throw new Error(
      "authenticatedPayload: confirmedTurn.canonicalAssistantState is required",
    );
  }

  const {
    state_level,
    current_phase,
    state_changed,
    prev_phase,
    prev_state_level,
  } = value;

  if (!isPhase1to5(state_level)) {
    throw new Error(
      "authenticatedPayload: state.state_level must be 1..5",
    );
  }

  if (!isPhase1to5(current_phase)) {
    throw new Error(
      "authenticatedPayload: state.current_phase must be 1..5",
    );
  }

  if (typeof state_changed !== "boolean") {
    throw new Error(
      "authenticatedPayload: state.state_changed is required",
    );
  }

  if (
    prev_phase !== null &&
    prev_phase !== undefined &&
    !isPhase1to5(prev_phase)
  ) {
    throw new Error(
      "authenticatedPayload: state.prev_phase must be null or 1..5",
    );
  }

  if (
    prev_state_level !== null &&
    prev_state_level !== undefined &&
    !isPhase1to5(prev_state_level)
  ) {
    throw new Error(
      "authenticatedPayload: state.prev_state_level must be null or 1..5",
    );
  }

  return value;
}

export function buildAuthenticatedChatPayload(params: {
  confirmedTurn: ConfirmedAssistantTurn;
  notification: NotificationState;
  resolvedConversationId: string;
  threadTitleForPayload: string;
  stateUpdateOk: boolean;
  stateUpdateError: string | null;
  debugSave: boolean;
  server_created_thread: boolean;
  server_created_client_request_id: string | null;
  cleanTrigger: boolean;
  memory_clean: any;
}): AuthenticatedChatPayload {
  const {
    confirmedTurn,
    notification,
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

  normalizeRequiredReply(confirmedTurn.assistantText);

  const assistantState = normalizeRequiredAssistantState(
    confirmedTurn.canonicalAssistantState,
  );
  const {
    state_level,
    current_phase,
    state_changed,
    prev_phase,
    prev_state_level,
  } = assistantState;

  const payload = {
    ok: true,
    notification,
    thread: {
      id: resolvedConversationId,
      title: threadTitleForPayload,
      state_level,
      current_phase,
      state_changed,
      prev_phase,
      prev_state_level,
    },
    state_update_ok: stateUpdateOk,
    state_update_error: stateUpdateError,
  } as AuthenticatedChatPayload;

  if (server_created_thread && debugSave && server_created_client_request_id) {
    payload.thread.client_request_id = server_created_client_request_id;
  }

  if (cleanTrigger) {
    payload.memory_clean = memory_clean;
  }

  return payload;
}

export default buildAuthenticatedChatPayload;

/*
このファイルの正式役割
authenticated 最終 payload の共通土台を組み立てるファイル。
confirmedTurn / notification / thread 情報を受けて、
クライアントへ返す AuthenticatedChatPayload の土台を作る。
このファイルは HOPY唯一の正を新規生成しない。
thread は確定状態の投影だけを持つ。
reply / state / assistant_state / Compass / hopy_confirmed_payload の最終搭載はここで行わない。
*/

/*
【今回このファイルで修正したこと】
- old top-level の reply / state / assistant_state / state_level / current_phase / state_changed / prev_phase / prev_state_level を payload へ載せる処理を削除しました。
- top-level の compass / hopy_confirmed_payload をこのファイルで組み立てる処理も削除しました。
- このファイルは thread への確定状態の投影と、notification / state_update 系の共通土台だけを返す形に戻しました。
- 状態値 1..5 の検証と confirmedTurn の必須検証は残しています。
*/

/* /app/api/chat/_lib/route/authenticatedPayload.ts */
// このファイルの正式役割: authenticated 最終 payload の共通土台を組み立てる