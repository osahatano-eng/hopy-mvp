// /app/api/chat/_lib/route/buildChatResponse.ts

import type { HopyStateLevel } from "../hopy/state/resolveHopyState";

export type BuildChatResponseInput = {
  ok?: unknown;
  error?: unknown;
  reply?: unknown;
  state?: {
    current_phase?: unknown;
    state_level?: unknown;
    prev_phase?: unknown;
    prev_state_level?: unknown;
    state_changed?: unknown;
    label?: unknown;
    prev_label?: unknown;
  } | null;
  notification?: {
    unread_count?: unknown;
    updated_at?: unknown;
  } | null;
  thread?: {
    id?: unknown;
    title?: unknown;
    state_level?: unknown;
    current_phase?: unknown;
    state_changed?: unknown;
    prev_phase?: unknown;
    prev_state_level?: unknown;
    updated_at?: unknown;
    last_assistant_at?: unknown;
  } | null;
  compass?: {
    text?: unknown;
    prompt?: unknown;
  } | null;
  debug?: unknown;
  hopy_confirmed_payload?: {
    reply?: unknown;
    state?: {
      current_phase?: unknown;
      state_level?: unknown;
      prev_phase?: unknown;
      prev_state_level?: unknown;
      state_changed?: unknown;
      label?: unknown;
      prev_label?: unknown;
    } | null;
    compass?: {
      text?: unknown;
      prompt?: unknown;
    } | null;
  } | null;
};

export type ChatResponseShape =
  | {
      ok: true;
      reply: string;
      state: {
        current_phase: HopyStateLevel;
        state_level: HopyStateLevel;
        prev_phase: HopyStateLevel;
        prev_state_level: HopyStateLevel;
        state_changed: boolean;
        label?: string;
        prev_label?: string;
      };
      notification: {
        unread_count: number;
        updated_at: string | null;
      };
      thread: {
        id: string;
        title: string;
        state_level: HopyStateLevel;
        current_phase: HopyStateLevel;
        state_changed: boolean;
        prev_phase: HopyStateLevel;
        prev_state_level: HopyStateLevel;
        updated_at: string | null;
        last_assistant_at: string | null;
      };
      compass?: {
        text: string;
        prompt: string | null;
      };
      debug?: unknown;
      hopy_confirmed_payload: {
        reply: string;
        state: {
          current_phase: HopyStateLevel;
          state_level: HopyStateLevel;
          prev_phase: HopyStateLevel;
          prev_state_level: HopyStateLevel;
          state_changed: boolean;
          label?: string;
          prev_label?: string;
        };
        compass?: {
          text: string;
          prompt: string | null;
        };
      };
    }
  | {
      ok: false;
      error: string;
      debug?: unknown;
    };

type NormalizedState = {
  current_phase: HopyStateLevel;
  state_level: HopyStateLevel;
  prev_phase: HopyStateLevel;
  prev_state_level: HopyStateLevel;
  state_changed: boolean;
  label?: string;
  prev_label?: string;
};

type NormalizedCompass = {
  text: string;
  prompt: string | null;
};

type NormalizedConfirmedPayload = {
  reply: string;
  state: NormalizedState;
  compass?: NormalizedCompass;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeStateLevelStrict(value: unknown): HopyStateLevel | null {
  if (isFiniteNumber(value)) {
    const rounded = Math.round(value);
    if (rounded === 1) return 1;
    if (rounded === 2) return 2;
    if (rounded === 3) return 3;
    if (rounded === 4) return 4;
    if (rounded === 5) return 5;
    return null;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    const numeric = Number(s);
    if (Number.isFinite(numeric)) {
      return normalizeStateLevelStrict(numeric);
    }

    const lower = s.toLowerCase();
    if (s === "混線" || lower === "mixed") return 1;
    if (s === "模索" || lower === "seeking") return 2;
    if (s === "整理" || lower === "organizing") return 3;
    if (s === "収束" || lower === "converging") return 4;
    if (s === "決定" || lower === "deciding") return 5;
  }

  return null;
}

function normalizeBooleanStrict(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }

  return null;
}

function normalizeString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const s = value.trim();
  return s || fallback;
}

function normalizeRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`buildChatResponse: ${fieldName} is required`);
  }

  const s = value.trim();
  if (!s) {
    throw new Error(`buildChatResponse: ${fieldName} is required`);
  }

  return s;
}

function normalizeCount(value: unknown, fallback = 0): number {
  if (isFiniteNumber(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isFinite(n)) {
      return Math.max(0, Math.round(n));
    }
  }

  return fallback;
}

function normalizeIsoDatetime(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    const date = new Date(s);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function normalizeOptionalLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s || undefined;
}

function normalizeCompassString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function labelFromStateLevel(level: HopyStateLevel): string {
  if (level === 1) return "混線";
  if (level === 2) return "模索";
  if (level === 3) return "整理";
  if (level === 4) return "収束";
  return "決定";
}

function normalizeStrictState(
  value: BuildChatResponseInput["state"],
  fieldPrefix: string,
): NormalizedState {
  if (!value) {
    throw new Error(`buildChatResponse: ${fieldPrefix} is required`);
  }

  const currentPhase = normalizeStateLevelStrict(value.current_phase);
  if (currentPhase === null) {
    throw new Error(
      `buildChatResponse: ${fieldPrefix}.current_phase is required`,
    );
  }

  const stateLevel = normalizeStateLevelStrict(value.state_level);
  if (stateLevel === null) {
    throw new Error(
      `buildChatResponse: ${fieldPrefix}.state_level is required`,
    );
  }

  const prevPhase = normalizeStateLevelStrict(value.prev_phase);
  if (prevPhase === null) {
    throw new Error(`buildChatResponse: ${fieldPrefix}.prev_phase is required`);
  }

  const prevStateLevel = normalizeStateLevelStrict(value.prev_state_level);
  if (prevStateLevel === null) {
    throw new Error(
      `buildChatResponse: ${fieldPrefix}.prev_state_level is required`,
    );
  }

  const stateChanged = normalizeBooleanStrict(value.state_changed);
  if (stateChanged === null) {
    throw new Error(
      `buildChatResponse: ${fieldPrefix}.state_changed is required`,
    );
  }

  const label =
    normalizeOptionalLabel(value.label) ?? labelFromStateLevel(stateLevel);

  const prevLabel =
    normalizeOptionalLabel(value.prev_label) ?? labelFromStateLevel(prevStateLevel);

  return {
    current_phase: currentPhase,
    state_level: stateLevel,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    state_changed: stateChanged,
    label,
    prev_label: prevLabel,
  };
}

function normalizeStrictThread(
  value: BuildChatResponseInput["thread"],
  fieldPrefix: string,
) {
  if (!value) {
    throw new Error(`buildChatResponse: ${fieldPrefix} is required`);
  }

  const currentPhase = normalizeStateLevelStrict(value.current_phase);
  if (currentPhase === null) {
    throw new Error(
      `buildChatResponse: ${fieldPrefix}.current_phase is required`,
    );
  }

  const stateLevel = normalizeStateLevelStrict(value.state_level);
  if (stateLevel === null) {
    throw new Error(
      `buildChatResponse: ${fieldPrefix}.state_level is required`,
    );
  }

  const prevPhase = normalizeStateLevelStrict(value.prev_phase);
  if (prevPhase === null) {
    throw new Error(`buildChatResponse: ${fieldPrefix}.prev_phase is required`);
  }

  const prevStateLevel = normalizeStateLevelStrict(value.prev_state_level);
  if (prevStateLevel === null) {
    throw new Error(
      `buildChatResponse: ${fieldPrefix}.prev_state_level is required`,
    );
  }

  const stateChanged = normalizeBooleanStrict(value.state_changed);
  if (stateChanged === null) {
    throw new Error(
      `buildChatResponse: ${fieldPrefix}.state_changed is required`,
    );
  }

  return {
    id: normalizeString(value.id),
    title: normalizeString(value.title),
    state_level: stateLevel,
    current_phase: currentPhase,
    state_changed: stateChanged,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    updated_at: normalizeIsoDatetime(value.updated_at),
    last_assistant_at: normalizeIsoDatetime(value.last_assistant_at),
  };
}

function normalizeStrictCompass(
  value: BuildChatResponseInput["compass"],
  fieldPrefix: string,
): NormalizedCompass | undefined {
  if (!value) return undefined;

  const text = normalizeCompassString(value.text);
  const prompt = normalizeCompassString(value.prompt);

  if (text === null && prompt === null) {
    return undefined;
  }

  if (text === null) {
    throw new Error(`buildChatResponse: ${fieldPrefix}.text is required`);
  }

  return {
    text,
    prompt,
  };
}

function normalizeConfirmedPayloadRequired(
  value: BuildChatResponseInput["hopy_confirmed_payload"],
): NormalizedConfirmedPayload {
  if (!value) {
    throw new Error("buildChatResponse: hopy_confirmed_payload is required");
  }

  const normalizedState = normalizeStrictState(
    value.state ?? null,
    "hopy_confirmed_payload.state",
  );

  const normalizedReply = normalizeRequiredString(
    value.reply,
    "hopy_confirmed_payload.reply",
  );

  const normalizedCompass = normalizeStrictCompass(
    value.compass ?? null,
    "hopy_confirmed_payload.compass",
  );

  return {
    reply: normalizedReply,
    state: normalizedState,
    ...(normalizedCompass ? { compass: normalizedCompass } : {}),
  };
}

function buildThreadFromConfirmedState(params: {
  thread: BuildChatResponseInput["thread"];
  confirmed: NormalizedState;
}) {
  const { thread, confirmed } = params;

  return {
    id: normalizeString(thread?.id),
    title: normalizeString(thread?.title),
    state_level: confirmed.state_level,
    current_phase: confirmed.current_phase,
    state_changed: confirmed.state_changed,
    prev_phase: confirmed.prev_phase,
    prev_state_level: confirmed.prev_state_level,
    updated_at: normalizeIsoDatetime(thread?.updated_at),
    last_assistant_at: normalizeIsoDatetime(thread?.last_assistant_at),
  };
}

function assertStateEquals(params: {
  fieldName: string;
  topLevel: NormalizedState | null;
  confirmed: NormalizedState;
}) {
  const { fieldName, topLevel, confirmed } = params;

  if (!topLevel) return;

  if (
    topLevel.current_phase !== confirmed.current_phase ||
    topLevel.state_level !== confirmed.state_level ||
    topLevel.prev_phase !== confirmed.prev_phase ||
    topLevel.prev_state_level !== confirmed.prev_state_level ||
    topLevel.state_changed !== confirmed.state_changed
  ) {
    throw new Error(
      `buildChatResponse: ${fieldName} must match hopy_confirmed_payload.state`,
    );
  }
}

function assertReplyEquals(params: {
  topLevel: string | null;
  confirmed: string;
}) {
  const { topLevel, confirmed } = params;
  if (topLevel === null) return;

  if (topLevel !== confirmed) {
    throw new Error(
      "buildChatResponse: reply must match hopy_confirmed_payload.reply",
    );
  }
}

function assertCompassEquals(params: {
  topLevel?: NormalizedCompass;
  confirmed?: NormalizedCompass;
}) {
  const { topLevel, confirmed } = params;

  const hasTopLevel = !!topLevel;
  const hasConfirmed = !!confirmed;

  if (!hasTopLevel && !hasConfirmed) return;

  if (hasTopLevel !== hasConfirmed) {
    throw new Error(
      "buildChatResponse: compass must match hopy_confirmed_payload.compass",
    );
  }

  if (!topLevel || !confirmed) return;

  if (
    topLevel.text !== confirmed.text ||
    topLevel.prompt !== confirmed.prompt
  ) {
    throw new Error(
      "buildChatResponse: compass must match hopy_confirmed_payload.compass",
    );
  }
}

export function buildChatResponse(
  input: BuildChatResponseInput = {},
): ChatResponseShape {
  const ok = typeof input.ok === "undefined" ? true : Boolean(input.ok);

  if (ok === false) {
    const error = normalizeRequiredString(input.error, "error");

    return {
      ok: false,
      error,
      ...(typeof input.debug === "undefined" ? {} : { debug: input.debug }),
    };
  }

  const notificationInput = input.notification ?? null;

  const normalizedConfirmedPayload = normalizeConfirmedPayloadRequired(
    input.hopy_confirmed_payload ?? null,
  );

  const normalizedTopLevelState = input.state
    ? normalizeStrictState(input.state, "state")
    : null;
  const normalizedTopLevelReply =
    typeof input.reply === "undefined" || input.reply === null
      ? null
      : normalizeRequiredString(input.reply, "reply");
  const normalizedTopLevelCompass = normalizeStrictCompass(
    input.compass ?? null,
    "compass",
  );

  assertReplyEquals({
    topLevel: normalizedTopLevelReply,
    confirmed: normalizedConfirmedPayload.reply,
  });

  assertStateEquals({
    fieldName: "state",
    topLevel: normalizedTopLevelState,
    confirmed: normalizedConfirmedPayload.state,
  });

  assertCompassEquals({
    topLevel: normalizedTopLevelCompass,
    confirmed: normalizedConfirmedPayload.compass,
  });

  return {
    ok: true,
    reply: normalizedConfirmedPayload.reply,
    state: normalizedConfirmedPayload.state,
    notification: {
      unread_count: normalizeCount(notificationInput?.unread_count, 0),
      updated_at: normalizeIsoDatetime(notificationInput?.updated_at),
    },
    thread: buildThreadFromConfirmedState({
      thread: input.thread ?? null,
      confirmed: normalizedConfirmedPayload.state,
    }),
    ...(normalizedConfirmedPayload.compass
      ? {
          compass: normalizedConfirmedPayload.compass,
        }
      : {}),
    ...(typeof input.debug === "undefined" ? {} : { debug: input.debug }),
    hopy_confirmed_payload: normalizedConfirmedPayload,
  };
}

export default buildChatResponse;

/*
このファイルの正式役割
最終 API レスポンスの正規化ファイル。
reply / state / notification / thread / compass / debug / hopy_confirmed_payload を受け取り、
クライアントへ返す ChatResponseShape に整えて返す。

このファイルが受け取るもの
input
- ok
- error
- reply
- state
- notification
- thread
- compass
- debug
- hopy_confirmed_payload

このファイルが渡すもの
ChatResponseShape
- ok
- error
- reply
- state
- notification
- thread
- compass
- debug
- hopy_confirmed_payload

Compass 観点でこのファイルの意味
このファイルは Compass の最終レスポンス整形場所。
ただし、Compass の生成はしない。
state_changed を見て Compass を消すこともしない。
受け取った値を検証し、唯一の正と一致するものだけをそのまま返す。
失敗系では成功系の必須値検証をしない。
成功系では hopy_confirmed_payload を唯一の正として必須化し、
top-level reply / state / compass がある場合のみ一致検証し、
最終 response は hopy_confirmed_payload 由来の値だけを返す。
*/

/*
【今回このファイルで修正したこと】
- ok:true の成功系で hopy_confirmed_payload を唯一の正として必須のまま維持しました。
- top-level reply / state / thread を成功系の必須入力から外しました。
- top-level reply / state / compass は「ある場合だけ一致検証する」形へ変更しました。
- thread は top-level state を必須にせず、hopy_confirmed_payload.state から最終値を組み立てる形へ変更しました。
- これにより、下流整形層で top-level 値不足だけを理由に唯一の正まで巻き添えで止める不正経路を止めました。
*/

/* /app/api/chat/_lib/route/buildChatResponse.ts */
// このファイルの正式役割: 最終 API レスポンスの正規化ファイル