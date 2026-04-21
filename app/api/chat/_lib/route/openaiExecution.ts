// /app/api/chat/_lib/route/openaiExecution.ts
import OpenAI from "openai";

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

function normalizeResolvedPlan(value: ResolvedPlanLike): string {
  return String(value ?? "").trim().toLowerCase();
}

function hasRequiredProCompassFounderSection(compassText: string): boolean {
  return String(compassText ?? "").includes("【創業者より、あなたへ】");
}

function buildStateStructureSystem(args: {
  uiLang: Lang;
}): string {
  if (args.uiLang === "ja") {
    return [
      "最重要出力ルール:",
      "返答は JSON object 1個だけで返すこと。",
      "markdown・コードブロック・説明文は禁止。",
      'トップレベルキーは "hopy_confirmed_payload" / "confirmed_memory_candidates" のみとすること。',
      "top-level の reply / state / assistant_state / compassText / compassPrompt / compass は返してはならない。",
      '"hopy_confirmed_payload" は必須。',
      '"hopy_confirmed_payload.reply" は 1文字以上必須。',
      '"hopy_confirmed_payload.state" は必須。',
      "hopy_confirmed_payload.state.current_phase / state_level / prev_phase / prev_state_level は 1|2|3|4|5 の整数必須。",
      "0..4 は禁止。",
      "hopy_confirmed_payload.state.state_changed は boolean 必須。",
      "state_changed は shape の飾りではない。",
      "state_changed は、その回に HOPY が確定した状態変化の正をそのまま返すこと。",
      "state_changed を false に固定したり、無難だから false にしたりしてはならない。",
      "下の数値と boolean は shape の例であり、そのまま固定コピーしてはならない。",
      '"confirmed_memory_candidates" は必須で、配列にすること。',
      "正式shape:",
      "{",
      '  "hopy_confirmed_payload": {',
      '    "reply": "HOPYの本文",',
      '    "state": {',
      '      "current_phase": 1,',
      '      "state_level": 1,',
      '      "prev_phase": 1,',
      '      "prev_state_level": 1,',
      '      "state_changed": false',
      "    }",
      "  },",
      '  "confirmed_memory_candidates": []',
      "}",
    ].join("\n");
  }

  return [
    "Most important output rule:",
    "Return exactly one JSON object.",
    "Do not output markdown, code fences, or explanations.",
    'The top-level keys must be only "hopy_confirmed_payload" and "confirmed_memory_candidates".',
    "Never return top-level reply, state, assistant_state, compassText, compassPrompt, or compass.",
    '"hopy_confirmed_payload" is required.',
    '"hopy_confirmed_payload.reply" must be a non-empty string.',
    '"hopy_confirmed_payload.state" is required.',
    "hopy_confirmed_payload.state.current_phase, state_level, prev_phase, and prev_state_level must be integers in 1|2|3|4|5.",
    "Never use 0..4.",
    "hopy_confirmed_payload.state.state_changed must be a boolean.",
    "state_changed is not decorative shape data.",
    "state_changed must reflect HOPY's confirmed transition truth for this turn.",
    "Do not default state_changed to false just because it looks safer.",
    "The numbers and boolean shown below are shape examples only, and must not be copied blindly.",
    '"confirmed_memory_candidates" is required and must be an array.',
    "Official shape:",
    "{",
    '  "hopy_confirmed_payload": {',
    '    "reply": "main reply",',
    '    "state": {',
    '      "current_phase": 1,',
    '      "state_level": 1,',
    '      "prev_phase": 1,',
    '      "prev_state_level": 1,',
    '      "state_changed": false',
    "    }",
    "  },",
    '  "confirmed_memory_candidates": []',
    "}",
  ].join("\n");
}

function buildStateMeaningSystem(args: {
  uiLang: Lang;
}): string {
  if (args.uiLang === "ja") {
    return [
      "状態確定ルール:",
      "hopy_confirmed_payload.state は、この回のユーザー入力と、この回に自分が確定した最終返答の意味から決めること。",
      "prev_phase / prev_state_level は入力前の参考状態である。",
      "current_phase / state_level は今回ターン後の確定状態である。",
      "入力前状態をそのまま current に持ち込んではならない。",
      "current と prev の意味が異なるなら state_changed=true にすること。",
      "current と prev の意味が同じときだけ state_changed=false にしてよい。",
      "『整理できた』『やることが見えてきた』『次の一歩が見えた』『方向が定まった』など前進意味なのに、prev=1 / current=1 / state_changed=false の固定コピーで逃げてはならない。",
      "下流は再判定しないため、このターンで自分が確定した真値をそのまま返すこと。",
    ].join("\n");
  }

  return [
    "State decision rule:",
    "Decide hopy_confirmed_payload.state from the meaning of this turn's user input and this turn's final reply that you have confirmed.",
    "prev_phase and prev_state_level are the reference state before this turn.",
    "current_phase and state_level are the confirmed state after this turn.",
    "Do not carry the pre-turn state into current unchanged by default.",
    "If current and prev differ in meaning, set state_changed=true.",
    "Set state_changed=false only when current and prev truly mean the same state.",
    'Do not escape with a copied prev=1 / current=1 / state_changed=false pattern when the reply clearly means progress such as "things became clearer", "the next step became visible", or "direction was found".',
    "Downstream will not re-judge this, so return the truth you confirmed in this turn.",
  ].join("\n");
}

function buildCompassStructureSystem(args: {
  uiLang: Lang;
  resolvedPlan: ResolvedPlanLike;
}): string {
  const plan = normalizeResolvedPlan(args.resolvedPlan);

  if (plan === "free") {
    if (args.uiLang === "ja") {
      return [
        "Compassルール:",
        "Free では Compass を出してはならない。",
        "state_changed=true でも hopy_confirmed_payload.compass を付けてはならない。",
        "Compass をトップレベルへ置いてはならない。",
        "reply と state は必ず hopy_confirmed_payload 内に返すこと。",
      ].join("\n");
    }

    return [
      "Compass rule:",
      "Do not output Compass on Free.",
      'Even when state_changed=true, do not include "hopy_confirmed_payload.compass".',
      "Never place Compass at the top level.",
      'Always return reply and state inside "hopy_confirmed_payload".',
    ].join("\n");
  }

  if (args.uiLang === "ja") {
    return [
      "Compassルール:",
      "Plus / Pro では HOPY回答○ と Compass を分離してはならない。",
      "hopy_confirmed_payload.state.state_changed=false のときは hopy_confirmed_payload.compass を付けてはならない。",
      "hopy_confirmed_payload.state.state_changed=true のときは hopy_confirmed_payload.compass を必ず付けること。",
      "その場合、hopy_confirmed_payload.compass.text は必ず非空で返すこと。",
      "その場合、hopy_confirmed_payload.compass.prompt も必ず非空で返すこと。",
      ...(plan === "pro"
        ? [
            "Pro では hopy_confirmed_payload.compass.text に必ず「【創業者より、あなたへ】」の見出しを含めること。",
            "Pro では「【創業者より、あなたへ】」を省略してはならない。",
          ]
        : []),
      "Compass をトップレベルへ置いてはならない。",
      "本文から Compass を推測したり、fallback 文字列でごまかしたりしてはならない。",
      'reply と state を "hopy_confirmed_payload" の外へ出してはならない。',
    ].join("\n");
  }

  return [
    "Compass rule:",
    "On Plus / Pro, never separate the HOPY reply badge truth and Compass truth.",
    'When "hopy_confirmed_payload.state.state_changed" is false, omit "hopy_confirmed_payload.compass" entirely.',
    'When "hopy_confirmed_payload.state.state_changed" is true, you must include "hopy_confirmed_payload.compass".',
    '"hopy_confirmed_payload.compass.text" must be non-empty in that case.',
    '"hopy_confirmed_payload.compass.prompt" must also be non-empty in that case.',
    ...(plan === "pro"
      ? [
          'On Pro, "hopy_confirmed_payload.compass.text" must include the exact section heading "【創業者より、あなたへ】".',
          'On Pro, do not omit the exact section heading "【創業者より、あなたへ】".',
        ]
      : []),
    "Never place Compass at the top level.",
    "Do not infer Compass from reply wording, and do not fake it with fallback text.",
    'Never place reply or state outside "hopy_confirmed_payload".',
  ].join("\n");
}

function buildEmptyJsonRetrySystem(args: {
  uiLang: Lang;
}): string {
  if (args.uiLang === "ja") {
    return [
      "再出力指示:",
      "直前の出力は空でした。",
      "今回は空文字を返してはいけません。",
      "必ず JSON object 1個だけを非空で返してください。",
      '最小でも "hopy_confirmed_payload" / "confirmed_memory_candidates" を含めてください。',
      '"hopy_confirmed_payload.reply" は 1文字以上必須です。',
      '"hopy_confirmed_payload.state" は必須です。',
      '"confirmed_memory_candidates" は空配列でもよいので必ず返してください。',
      "top-level の reply / state / compassText / compassPrompt は禁止です。",
      "state_changed を false に固定して逃げてはいけません。",
    ].join("\n");
  }

  return [
    "Retry instruction:",
    "The previous output was empty.",
    "Do not return an empty string this time.",
    "Return exactly one non-empty JSON object.",
    'At minimum include "hopy_confirmed_payload" and "confirmed_memory_candidates".',
    '"hopy_confirmed_payload.reply" must contain at least 1 character.',
    '"hopy_confirmed_payload.state" is required.',
    '"confirmed_memory_candidates" may be empty but must be present.',
    "Top-level reply, state, compassText, and compassPrompt are forbidden.",
    "Do not escape by defaulting state_changed to false.",
  ].join("\n");
}

function buildContractRetrySystem(args: {
  uiLang: Lang;
  proCompassFounderRequired: boolean;
}): string {
  if (args.uiLang === "ja") {
    return [
      "再出力指示:",
      "直前の JSON は HOPY の正式契約に違反していました。",
      "今回は hopy_confirmed_payload 正式shape を厳守してください。",
      "トップレベルキーは hopy_confirmed_payload / confirmed_memory_candidates のみです。",
      "top-level の reply / state / assistant_state / compassText / compassPrompt / compass は禁止です。",
      "hopy_confirmed_payload.state.current_phase / state_level / prev_phase / prev_state_level は 1|2|3|4|5 の整数必須です。",
      "hopy_confirmed_payload.state.state_changed は boolean 必須です。",
      "state_changed を false に固定してはなりません。",
      "Free では hopy_confirmed_payload.compass を付けてはなりません。",
      "Plus / Pro では state_changed=true の回に hopy_confirmed_payload.compass.text を必ず非空で返してください。",
      "Plus / Pro では state_changed=true の回に hopy_confirmed_payload.compass.prompt も必ず非空で返してください。",
      ...(args.proCompassFounderRequired
        ? [
            "Pro では state_changed=true の回に hopy_confirmed_payload.compass.text へ必ず「【創業者より、あなたへ】」の見出しを含めてください。",
            "Pro では「【創業者より、あなたへ】」を省略してはなりません。",
          ]
        : []),
      "空文字や省略や fallback でごまかしてはいけません。",
      "必ず JSON object 1個だけを返してください。",
    ].join("\n");
  }

  return [
    "Retry instruction:",
    "The previous JSON violated the HOPY contract.",
    "Return the official hopy_confirmed_payload shape exactly this time.",
    'The top-level keys must be only "hopy_confirmed_payload" and "confirmed_memory_candidates".',
    "Top-level reply, state, assistant_state, compassText, compassPrompt, and compass are forbidden.",
    "hopy_confirmed_payload.state.current_phase, state_level, prev_phase, and prev_state_level must be integers in 1|2|3|4|5.",
    "hopy_confirmed_payload.state.state_changed must be a boolean.",
    "Do not hard-code state_changed to false.",
    'On Free, do not return "hopy_confirmed_payload.compass".',
    'On Plus / Pro, when state_changed=true, "hopy_confirmed_payload.compass.text" must be non-empty.',
    'On Plus / Pro, when state_changed=true, "hopy_confirmed_payload.compass.prompt" must also be non-empty.',
    ...(args.proCompassFounderRequired
      ? [
          'On Pro, when state_changed=true, "hopy_confirmed_payload.compass.text" must include the exact section heading "【創業者より、あなたへ】".',
          'On Pro, do not omit the exact section heading "【創業者より、あなたへ】".',
        ]
      : []),
    "Do not fake compliance with empty strings, omissions, or fallback text.",
    "Return exactly one JSON object.",
  ].join("\n");
}

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

function detectProPlanFromMessages(messages: OpenAIChatMessage[]): boolean {
  const joined = messages
    .map((message) => String(message.content ?? ""))
    .join("\n")
    .toLowerCase();

  return (
    joined.includes(
      "pro では hopy_confirmed_payload.compass.text に必ず「【創業者より、あなたへ】」",
    ) ||
    joined.includes(
      'on pro, "hopy_confirmed_payload.compass.text" must include the exact section heading "【創業者より、あなたへ】"',
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
  const isProPlan = detectProPlanFromMessages(args.messages);

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

  if (isProPlan && !hasRequiredProCompassFounderSection(compassText)) {
    throw new Error(
      "invalid_hopy_json_contract | pro_requires_founder_compass_heading",
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
              proCompassFounderRequired: detectProPlanFromMessages(
                params.messages,
              ),
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
HOPY唯一の正に従う confirmed payload の shape を OpenAI 実行層でも強制し、
promptBundle と history から最終 messages を構成し、
completion 実行を安定して OpenAI 呼び出し層へ渡す責務を持つ。
Compass本文を後付け生成せず、OpenAI返却JSONがプランごとの契約を満たしているかだけを
確定前に検証する。
*/

/*
【今回このファイルで修正したこと】
- 未使用だった isProResolvedPlan を削除した。
- Pro Compass の契約文、retry 指示、JSON契約検証は維持した。
- Compass本文の後付け生成、固定補完、DB、UI、state_changed、state_level / current_phase / prev系には触っていない。
*/
// /app/api/chat/_lib/route/openaiExecution.ts