// /components/chat/lib/chatSendCompass.ts
import type { ChatMsg } from "./chatTypes";

type ConfirmedCompassPayload = {
  text?: string | null;
  prompt?: string | null;
};

type ConfirmedMeaningPayload = {
  compass?: ConfirmedCompassPayload | null;
  ui_effects?: unknown;
};

type ApiResponse<TState> = {
  ok: boolean;
  compass?: {
    text?: string | null;
    prompt?: string | null;
  } | null;
  compassText?: string | null;
  compassPrompt?: string | null;
  compass_text?: string | null;
  compass_prompt?: string | null;
  hopy_confirmed_payload?: ConfirmedMeaningPayload | null;
  state?: TState | null;
};

function normalizeCompassText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeCompassPrompt(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

export function resolveConfirmedCompassText<TState>(
  _payload: ApiResponse<TState>,
  confirmedPayload: ConfirmedMeaningPayload | null
): string | null {
  const confirmedAny = (confirmedPayload ?? null) as any;

  return normalizeCompassText(
    confirmedAny?.compass?.text ??
      confirmedAny?.ui_effects?.compass?.text ??
      null
  );
}

export function resolveConfirmedCompassPrompt<TState>(
  _payload: ApiResponse<TState>,
  confirmedPayload: ConfirmedMeaningPayload | null
): string | null {
  const confirmedAny = (confirmedPayload ?? null) as any;

  return normalizeCompassPrompt(
    confirmedAny?.compass?.prompt ??
      confirmedAny?.ui_effects?.compass?.prompt ??
      null
  );
}

export function mergeAssistantCompassFields(
  message: ChatMsg,
  compassText: string | null,
  compassPrompt: string | null
): ChatMsg {
  const next = { ...(message as any) };

  if (compassText || compassPrompt) {
    next.compass = {
      ...(compassText ? { text: compassText } : {}),
      ...(compassPrompt ? { prompt: compassPrompt } : {}),
    };

    if (compassText) {
      next.compass_text = compassText;
    } else {
      delete next.compass_text;
    }

    if (compassPrompt) {
      next.compass_prompt = compassPrompt;
    } else {
      delete next.compass_prompt;
    }
  } else {
    delete next.compass;
    delete next.compass_text;
    delete next.compass_prompt;
  }

  return next as ChatMsg;
}

/*
このファイルの正式役割
Compass の確定値を解決し、assistant message へ反映する専用ファイル。
confirmed payload から compass.text / compass.prompt を取り出し、
message.compass / message.compass_text / message.compass_prompt へ積む責務だけを担当する。

【今回このファイルで修正したこと】
- useChatSend.ts 内にあった Compass 正規化関数をこのファイルへ分離しました。
- confirmed payload から Compass を取り出す関数をこのファイルへ分離しました。
- assistant message へ Compass 情報を積む関数をこのファイルへ分離しました。
*/