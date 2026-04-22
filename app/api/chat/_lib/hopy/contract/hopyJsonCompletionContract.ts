// /app/api/chat/_lib/hopy/contract/hopyJsonCompletionContract.ts
import type { OpenAIChatMessage } from "../openai/hopyOpenAIMessages";

type PhaseValue = 1 | 2 | 3 | 4 | 5;

type CompletionLike = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string | null;
      content?: string | null;
      refusal?: unknown;
    } | null;
  }>;
};

const ALLOWED_TOP_LEVEL_KEYS = new Set([
  "hopy_confirmed_payload",
  "confirmed_memory_candidates",
]);

const FORBIDDEN_TOP_LEVEL_KEYS = [
  "reply",
  "state",
  "assistant_state",
  "compassText",
  "compassPrompt",
  "compass",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasChoicesCompletion(value: unknown): value is CompletionLike {
  return isRecord(value) && "choices" in value;
}

function readCompletionContent(completion: unknown): string {
  if (!hasChoicesCompletion(completion)) return "";
  return String(completion.choices?.[0]?.message?.content ?? "").trim();
}

function buildContentPreview(content: string): string {
  return JSON.stringify(String(content ?? "").trim().slice(0, 500));
}

function buildEmptyJsonContentErrorMessage(completion: unknown): string {
  if (!hasChoicesCompletion(completion)) {
    return [
      "empty_json_content",
      "finish_reason=unknown",
      "message_role=unknown",
      "has_refusal=false",
    ].join(" | ");
  }

  const finishReason = String(
    completion.choices?.[0]?.finish_reason ?? "",
  ).trim();
  const messageRole = String(
    completion.choices?.[0]?.message?.role ?? "",
  ).trim();
  const refusal = String(
    completion.choices?.[0]?.message?.refusal ?? "",
  ).trim();

  return [
    "empty_json_content",
    `finish_reason=${finishReason || "unknown"}`,
    `message_role=${messageRole || "unknown"}`,
    `has_refusal=${refusal ? "true" : "false"}`,
  ].join(" | ");
}

function ensureJsonCompletionHasContent<TCompletion>(
  completion: TCompletion,
): TCompletion {
  const content = readCompletionContent(completion);
  if (content) {
    return completion;
  }

  throw new Error(buildEmptyJsonContentErrorMessage(completion));
}

function parseJsonObjectContent(content: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!isRecord(parsed)) {
      throw new Error(
        `invalid_json_object_content | root_not_object | raw_preview=${buildContentPreview(
          content,
        )}`,
      );
    }
    return parsed;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("invalid_json_object_content")
    ) {
      throw error;
    }

    throw new Error(
      `invalid_json_object_content | parse_failed | raw_preview=${buildContentPreview(
        content,
      )}`,
    );
  }
}

function isPhaseValue(value: unknown): value is PhaseValue {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

function readRequiredPhaseValue(
  state: Record<string, unknown>,
  key: "current_phase" | "state_level" | "prev_phase" | "prev_state_level",
): PhaseValue {
  const value = state[key];
  if (!isPhaseValue(value)) {
    throw new Error(
      `invalid_hopy_json_contract | ${key}_must_be_1_to_5_integer`,
    );
  }
  return value;
}

function readRequiredStateChanged(state: Record<string, unknown>): boolean {
  const value = state["state_changed"];
  if (typeof value !== "boolean") {
    throw new Error(
      "invalid_hopy_json_contract | state_changed_must_be_boolean",
    );
  }
  return value;
}

function readStringField(
  body: Record<string, unknown>,
  key: string,
): string {
  const value = body[key];
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function readRequiredObjectField(
  body: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  const value = body[key];
  if (!isRecord(value)) {
    throw new Error(`invalid_hopy_json_contract | ${key}_missing_or_invalid`);
  }
  return value;
}

function readOptionalObjectField(
  body: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = body[key];
  if (value == null) return null;
  if (!isRecord(value)) {
    throw new Error(`invalid_hopy_json_contract | ${key}_must_be_object`);
  }
  return value;
}

function ensureConfirmedMemoryCandidates(
  body: Record<string, unknown>,
): void {
  const value = body["confirmed_memory_candidates"];
  if (!Array.isArray(value)) {
    throw new Error(
      "invalid_hopy_json_contract | confirmed_memory_candidates_missing_or_invalid",
    );
  }
}

function ensureNoForbiddenTopLevelKeys(
  body: Record<string, unknown>,
): void {
  for (const key of FORBIDDEN_TOP_LEVEL_KEYS) {
    if (key in body) {
      throw new Error(
        `invalid_hopy_json_contract | forbidden_top_level_key_${key}`,
      );
    }
  }
}

function ensureOnlyAllowedTopLevelKeys(
  body: Record<string, unknown>,
): void {
  const unexpectedKeys = Object.keys(body).filter(
    (key) => !ALLOWED_TOP_LEVEL_KEYS.has(key),
  );

  if (unexpectedKeys.length > 0) {
    throw new Error(
      `invalid_hopy_json_contract | unexpected_top_level_keys_${unexpectedKeys.join("_")}`,
    );
  }
}

function detectFreePlanFromMessages(messages: OpenAIChatMessage[]): boolean {
  const joined = messages
    .map((message) => String(message.content ?? ""))
    .join("\n")
    .toLowerCase();

  return (
    joined.includes("do not output compass on free.") ||
    joined.includes("free では compass を出してはならない。") ||
    joined.includes(
      'even when state_changed=true, do not include "hopy_confirmed_payload.compass".',
    ) ||
    joined.includes(
      "state_changed=true でも hopy_confirmed_payload.compass を付けてはならない。",
    )
  );
}

function ensureJsonCompletionMatchesHopyContract<TCompletion>(args: {
  completion: TCompletion;
  messages: OpenAIChatMessage[];
}): TCompletion {
  const content = readCompletionContent(args.completion);
  const body = parseJsonObjectContent(content);

  ensureNoForbiddenTopLevelKeys(body);
  ensureOnlyAllowedTopLevelKeys(body);
  ensureConfirmedMemoryCandidates(body);

  const confirmedPayload = readRequiredObjectField(
    body,
    "hopy_confirmed_payload",
  );

  const reply = readStringField(confirmedPayload, "reply");
  if (!reply) {
    throw new Error(
      "invalid_hopy_json_contract | hopy_confirmed_payload_reply_missing_or_empty",
    );
  }

  const state = readRequiredObjectField(confirmedPayload, "state");

  readRequiredPhaseValue(state, "current_phase");
  readRequiredPhaseValue(state, "state_level");
  readRequiredPhaseValue(state, "prev_phase");
  readRequiredPhaseValue(state, "prev_state_level");
  const stateChanged = readRequiredStateChanged(state);

  const compass = readOptionalObjectField(confirmedPayload, "compass");
  const isFreePlan = detectFreePlanFromMessages(args.messages);

  if (isFreePlan) {
    if (compass) {
      throw new Error(
        "invalid_hopy_json_contract | free_must_not_return_compass",
      );
    }
    return args.completion;
  }

  if (!stateChanged) {
    if (compass) {
      throw new Error(
        "invalid_hopy_json_contract | compass_must_be_omitted_when_state_not_changed",
      );
    }
    return args.completion;
  }

  if (!compass) {
    throw new Error(
      "invalid_hopy_json_contract | plus_or_pro_requires_compass_when_state_changed",
    );
  }

  const compassText = readStringField(compass, "text");
  if (!compassText) {
    throw new Error(
      "invalid_hopy_json_contract | plus_or_pro_requires_compass_text_when_state_changed",
    );
  }

  const compassPrompt = readStringField(compass, "prompt");
  if (!compassPrompt) {
    throw new Error(
      "invalid_hopy_json_contract | plus_or_pro_requires_compass_prompt_when_state_changed",
    );
  }

  return args.completion;
}

export function ensureJsonCompletionIsValid<TCompletion>(args: {
  completion: TCompletion;
  messages: OpenAIChatMessage[];
}): TCompletion {
  const withContent = ensureJsonCompletionHasContent(args.completion);
  return ensureJsonCompletionMatchesHopyContract({
    completion: withContent,
    messages: args.messages,
  });
}

/*
このファイルの正式役割:
OpenAI completion の JSON 出力が HOPY の正式契約に一致しているかを検証するファイル。
hopy_confirmed_payload、confirmed_memory_candidates、state 1..5、state_changed、Compass の契約を検証する責務だけを持つ。
OpenAI completion 実行、timeout / retry 実行、messages 組み立て、プロンプト文言生成、DB保存復元、HOPY唯一の正の再判定は担当しない。
*/

/*
【今回このファイルで修正したこと】
- OpenAIChatMessage の type import を ../../route/openaiExecution ではなく ../openai/hopyOpenAIMessages から直接読むように変更しました。
- parse_failed / root_not_object 時に raw_preview を error message に含めるようにしました。
- これにより、JSON parse 失敗時にモデルが実際に何を返したかを次のログで確認できるようにしました。
- JSON契約検証、state 1..5、state_changed、Compass条件、DB保存復元、HOPY唯一の正の再判定には触れていません。
*/

/* /app/api/chat/_lib/hopy/contract/hopyJsonCompletionContract.ts */