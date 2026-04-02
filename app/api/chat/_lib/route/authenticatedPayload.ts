// /app/api/chat/_lib/route/authenticatedPayload.ts

import type { NotificationState } from "../state/notification";
import type {
  AuthenticatedChatPayload,
  ConfirmedAssistantTurn,
} from "./authenticatedTypes";

type AuthenticatedChatPayloadWithConfirmedCompass = AuthenticatedChatPayload & {
  hopy_confirmed_payload?: {
    reply: string;
    state: ConfirmedAssistantTurn["canonicalAssistantState"];
    compass?: {
      text: string;
      prompt: string | null;
    };
  };
  compass?: {
    text: string;
    prompt: string | null;
  };
};

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

  if (prev_phase !== null && prev_phase !== undefined && !isPhase1to5(prev_phase)) {
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

function normalizeOptionalCompass(
  confirmedTurn: ConfirmedAssistantTurn,
):
  | {
      text: string;
      prompt: string | null;
    }
  | undefined {
  const rawCompassText = (
    confirmedTurn as ConfirmedAssistantTurn & { compassText?: unknown }
  ).compassText;

  const rawCompassPrompt = (
    confirmedTurn as ConfirmedAssistantTurn & { compassPrompt?: unknown }
  ).compassPrompt;

  const generatedCompassText =
    typeof rawCompassText === "string" ? rawCompassText.trim() : "";

  const generatedCompassPrompt =
    typeof rawCompassPrompt === "string" ? rawCompassPrompt.trim() : "";

  if (generatedCompassText.length === 0) {
    return undefined;
  }

  return {
    text: generatedCompassText,
    prompt: generatedCompassPrompt.length > 0 ? generatedCompassPrompt : null,
  };
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

  const assistantReply = normalizeRequiredReply(confirmedTurn.assistantText);
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

  const resolvedCompass = normalizeOptionalCompass(confirmedTurn);

  const payload: AuthenticatedChatPayloadWithConfirmedCompass = {
    ok: true,
    reply: assistantReply,
    state: assistantState,
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
    state_level,
    current_phase,
    state_changed,
    prev_phase,
    prev_state_level,
    assistant_state: assistantState,
    ...(resolvedCompass ? { compass: resolvedCompass } : {}),
    hopy_confirmed_payload: {
      reply: assistantReply,
      state: assistantState,
      ...(resolvedCompass ? { compass: resolvedCompass } : {}),
    },
  };

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
authenticated 最終 payload 組み立てファイル。
confirmedTurn / notification / thread 情報を受けて、
クライアントへ返す AuthenticatedChatPayload を組み立てる。
Compass 観点では、上流で確定済みの Compass を
payload.compass と hopy_confirmed_payload.compass にそのまま載せる。
このファイルは Compass を生成しない。
*/

/*
【今回このファイルで修正したこと】
- reply 未確定のまま ok:true payload を返さないように、assistantText の必須チェックを追加しました。
- state 未確定や 1..5 以外の値を通さないように、canonicalAssistantState の runtime 検証を追加しました。
- payload と hopy_confirmed_payload の reply を、trim 後の確定済み assistantReply に統一しました。
- Compass は confirmedTurn の確定済み値だけをそのまま載せるままにし、ここで生成しない構造を維持しました。
*/
// このファイルの正式役割: authenticated 最終 payload 組み立てファイル