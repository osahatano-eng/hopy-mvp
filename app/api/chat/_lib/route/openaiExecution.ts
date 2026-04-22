// /app/api/chat/_lib/route/openaiExecution.ts
import OpenAI from "openai";

import {
  buildCompassStructureSystem,
  buildContractRetrySystem,
  buildEmptyJsonRetrySystem,
  buildStateMeaningSystem,
  buildStateStructureSystem,
} from "../hopy/prompt/hopyOpenAIJsonContractPrompt";
import { phaseParams } from "../phase/phaseParams";
import type { Lang } from "../router/simpleRouter";
import type { PromptBundle } from "./promptBundle";
import type { ResolvedPlanLike } from "./openaiPlan";
import {
  memoryOutputContractSystem,
  planPrioritySystem,
} from "./openaiContracts";
import { buildFinalHistory } from "./history";

export type HistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type PhaseValue = 1 | 2 | 3 | 4 | 5;

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

export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  if (!(ms > 0)) return p;

  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);

    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableOpenAIError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("openai_timeout")) return true;
  if (lowerMessage.includes("timeout")) return true;
  if (lowerMessage.includes("rate limit")) return true;
  if (lowerMessage.includes("temporarily")) return true;
  if (lowerMessage.includes("temporarily unavailable")) return true;
  if (lowerMessage.includes("overloaded")) return true;
  if (lowerMessage.includes("connection")) return true;
  if (lowerMessage.includes("network")) return true;
  if (lowerMessage.includes("fetch failed")) return true;
  if (lowerMessage.includes("econnreset")) return true;
  if (lowerMessage.includes("socket hang up")) return true;
  if (lowerMessage.includes("empty_json_content")) return true;
  if (lowerMessage.includes("invalid_json_object_content")) return true;
  if (lowerMessage.includes("invalid_hopy_json_contract")) return true;

  const status = Number((error as { status?: unknown } | null)?.status);
  if (status === 408 || status === 409 || status === 429) return true;
  if (status >= 500 && status < 600) return true;

  const code = String(
    (error as { code?: unknown } | null)?.code ?? "",
  ).toLowerCase();
  if (code === "etimedout") return true;
  if (code === "econnreset") return true;
  if (code === "und_err_connect_timeout") return true;

  const name = String(
    (error as { name?: unknown } | null)?.name ?? "",
  ).toLowerCase();
  if (name.includes("timeout")) return true;
  if (name.includes("connection")) return true;
  if (name.includes("rate")) return true;

  return false;
}

async function withSingleRetry<T>(args: {
  run: () => Promise<T>;
  retryDelayMs: number;
}): Promise<T> {
  try {
    return await args.run();
  } catch (error) {
    if (!isRetryableOpenAIError(error)) {
      throw error;
    }

    if (args.retryDelayMs > 0) {
      await sleep(args.retryDelayMs);
    }

    return args.run();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasChoicesCompletion(
  value: unknown,
): value is {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      role?: string | null;
      content?: string | null;
      refusal?: unknown;
    } | null;
  }>;
} {
  return isRecord(value) && "choices" in value;
}

function readCompletionContent(
  completion: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>,
): string {
  if (!hasChoicesCompletion(completion)) return "";
  return String(completion.choices?.[0]?.message?.content ?? "").trim();
}

function buildEmptyJsonContentErrorMessage(
  completion: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>,
): string {
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

function ensureJsonCompletionHasContent(
  completion: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>,
): Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>> {
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
      throw new Error("invalid_json_object_content | root_not_object");
    }
    return parsed;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("invalid_json_object_content")
    ) {
      throw error;
    }
    throw new Error("invalid_json_object_content | parse_failed");
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

function ensureJsonCompletionMatchesHopyContract(args: {
  completion: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
  messages: OpenAIChatMessage[];
}): Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>> {
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

function ensureJsonCompletionIsValid(args: {
  completion: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;
  messages: OpenAIChatMessage[];
}): Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>> {
  const withContent = ensureJsonCompletionHasContent(args.completion);
  return ensureJsonCompletionMatchesHopyContract({
    completion: withContent,
    messages: args.messages,
  });
}

export function buildOpenAIMessages(args: {
  promptBundle: PromptBundle;
  history: HistoryItem[];
  userText: string;
  replyLang: Lang;
  resolvedPlan: ResolvedPlanLike;
}): OpenAIChatMessage[] {
  const finalHistory = buildFinalHistory({
    history: args.history,
    userText: args.userText,
    resolvedPlan: args.resolvedPlan,
  });

  const normalizedHopyUserPrompt = String(
    args.promptBundle.userPrompt ?? "",
  ).trim();

  const stateStructureSystem = buildStateStructureSystem({
    uiLang: args.replyLang,
  });

  const stateMeaningSystem = buildStateMeaningSystem({
    uiLang: args.replyLang,
  });

  const compassStructureSystem = buildCompassStructureSystem({
    uiLang: args.replyLang,
    resolvedPlan: args.resolvedPlan,
  });

  return [
    { role: "system", content: args.promptBundle.coreSystemPrompt },
    { role: "system", content: args.promptBundle.baseSystemPrompt },
    { role: "system", content: args.promptBundle.continuitySystemPrompt },
    { role: "system", content: args.promptBundle.personaSystemPrompt },
    { role: "system", content: args.promptBundle.styleSystemPrompt },
    {
      role: "system",
      content: planPrioritySystem({
        uiLang: args.replyLang,
        resolvedPlan: args.resolvedPlan,
      }),
    },
    ...(stateStructureSystem
      ? [{ role: "system" as const, content: stateStructureSystem }]
      : []),
    ...(stateMeaningSystem
      ? [{ role: "system" as const, content: stateMeaningSystem }]
      : []),
    ...(compassStructureSystem
      ? [{ role: "system" as const, content: compassStructureSystem }]
      : []),
    { role: "system", content: args.promptBundle.antiPlatitudePrompt },
    { role: "system", content: args.promptBundle.complianceSystemPrompt },
    { role: "system", content: args.promptBundle.replyLanguageLockPrompt },
    { role: "system", content: memoryOutputContractSystem(args.replyLang) },
    ...(normalizedHopyUserPrompt
      ? [{ role: "system" as const, content: normalizedHopyUserPrompt }]
      : []),
    ...finalHistory.map((m) => ({ role: m.role, content: m.content })),
  ];
}

async function runJsonForcedCompletion(params: {
  openai: OpenAI;
  modelName: string;
  messages: OpenAIChatMessage[];
  phaseForParams: 1 | 2 | 3 | 4 | 5;
  openaiTimeoutMs: number;
  maxTokens: number;
}) {
  const completion = await withTimeout(
    params.openai.chat.completions.create({
      model: params.modelName,
      messages: params.messages,
      response_format: { type: "json_object" },
      ...phaseParams(params.phaseForParams),
    }),
    params.openaiTimeoutMs,
    "openai",
  );

  return ensureJsonCompletionIsValid({
    completion,
    messages: params.messages,
  });
}

export async function createJsonForcedCompletion(params: {
  openai: OpenAI;
  modelName: string;
  messages: OpenAIChatMessage[];
  phaseForParams: 1 | 2 | 3 | 4 | 5;
  openaiTimeoutMs: number;
  maxTokens: number;
  replyLang: Lang;
}) {
  return withSingleRetry({
    retryDelayMs: 250,
    run: async () => {
      try {
        return await runJsonForcedCompletion(params);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error ?? "");
        const lowerMessage = message.toLowerCase();

        const shouldRetryWithExtraSystemPrompt =
          lowerMessage.includes("empty_json_content") ||
          lowerMessage.includes("invalid_json_object_content") ||
          lowerMessage.includes("invalid_hopy_json_contract");

        if (!shouldRetryWithExtraSystemPrompt) {
          throw error;
        }

        const retryMessages: OpenAIChatMessage[] = [
          ...params.messages,
          {
            role: "system",
            content: buildEmptyJsonRetrySystem({
              uiLang: params.replyLang,
            }),
          },
          {
            role: "system",
            content: buildContractRetrySystem({
              uiLang: params.replyLang,
            }),
          },
          {
            role: "system",
            content: buildStateMeaningSystem({
              uiLang: params.replyLang,
            }),
          },
        ];

        return runJsonForcedCompletion({
          ...params,
          messages: retryMessages,
        });
      }
    },
  });
}

export async function createPlainCompletion(params: {
  openai: OpenAI;
  modelName: string;
  messages: OpenAIChatMessage[];
  phaseForParams: 1 | 2 | 3 | 4 | 5;
  openaiTimeoutMs: number;
  maxTokens: number;
}) {
  return withSingleRetry({
    retryDelayMs: 250,
    run: () =>
      withTimeout(
        params.openai.chat.completions.create({
          model: params.modelName,
          messages: params.messages,
          ...phaseParams(params.phaseForParams),
        }),
        params.openaiTimeoutMs,
        "openai",
      ),
  });
}

/*
このファイルの正式役割:
OpenAI へ渡す messages の組み立てと、
OpenAI completion 実行時の timeout / 一時失敗制御を担うファイル。
HOPY唯一の正に従う confirmed payload の契約検証を OpenAI 実行層で強制し、
promptBundle と history から最終 messages を構成し、
completion 実行を安定して OpenAI 呼び出し層へ渡す責務を持つ。
HOPY JSON 契約プロンプト文言の本体は、
/app/api/chat/_lib/hopy/prompt/hopyOpenAIJsonContractPrompt.ts から読み込む。
*/

/*
【今回このファイルで修正したこと】
- HOPY JSON 契約プロンプト文言の生成責務を /app/api/chat/_lib/hopy/prompt/hopyOpenAIJsonContractPrompt.ts へ移し、このファイルでは import して使うだけにしました。
- buildStateStructureSystem(...) / buildStateMeaningSystem(...) / buildCompassStructureSystem(...) / buildEmptyJsonRetrySystem(...) / buildContractRetrySystem(...) の本体をこのファイルから削除しました。
- OpenAI 実行、timeout、single retry、plain completion、JSON契約検証ロジック、state値 1..5、Compass契約条件は変更していません。
*/

/* /app/api/chat/_lib/route/openaiExecution.ts */