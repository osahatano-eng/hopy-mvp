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

function normalizeResolvedPlan(value: ResolvedPlanLike): string {
  return String(value ?? "").trim().toLowerCase();
}

function buildStateStructureSystem(args: {
  uiLang: Lang;
}): string {
  if (args.uiLang === "ja") {
    return [
      "最重要出力ルール:",
      "返答は JSON object 1個だけで返すこと。",
      "markdown・コードブロック・説明文は禁止。",
      "トップレベルキーとして reply / state / compassText / compassPrompt を必ず返すこと。",
      "state は必須。",
      "state を省略してはいけない。",
      "state を null にしてはいけない。",
      "state_changed は boolean 必須。",
      "current_phase / state_level / prev_phase / prev_state_level は 1|2|3|4|5 の整数必須。",
      "0..4 は禁止。",
      "正式shape:",
      "{",
      '  "reply": "HOPYの本文",',
      '  "state": {',
      '    "current_phase": 1,',
      '    "state_level": 1,',
      '    "prev_phase": 1,',
      '    "prev_state_level": 1,',
      '    "state_changed": false',
      "  },",
      '  "compassText": "",',
      '  "compassPrompt": ""',
      "}",
    ].join("\n");
  }

  return [
    "Most important output rule:",
    "Return exactly one JSON object.",
    "Do not output markdown, code fences, or explanations.",
    "Always return these top-level keys: reply, state, compassText, compassPrompt.",
    "state is mandatory.",
    "Do not omit state.",
    "Do not return state as null.",
    "state_changed must be a boolean.",
    "current_phase, state_level, prev_phase, prev_state_level must be integers in 1|2|3|4|5.",
    "Never use 0..4.",
    "Official shape:",
    "{",
    '  "reply": "main reply",',
    '  "state": {',
    '    "current_phase": 1,',
    '    "state_level": 1,',
    '    "prev_phase": 1,',
    '    "prev_state_level": 1,',
    '    "state_changed": false',
    "  },",
    '  "compassText": "",',
    '  "compassPrompt": ""',
    "}",
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
        "Free では Compass を出さないこと。",
        'compassText は必ず "" にすること。',
        'compassPrompt も必ず "" にすること。',
        "reply と state は必ず返すこと。",
      ].join("\n");
    }

    return [
      "Compass rule:",
      "Do not output Compass on Free.",
      'compassText must always be "".',
      'compassPrompt must always be "".',
      "Always return reply and state.",
    ].join("\n");
  }

  if (args.uiLang === "ja") {
    return [
      "Compassルール:",
      'state_changed=false のときは compassText と compassPrompt を必ず "" にすること。',
      "state_changed=true のときは compassText と compassPrompt を必ず非空で返すこと。",
      "compassText は短くてよい。",
      "compassPrompt も短くてよい。",
      "ただし reply と state を最優先し、絶対に省略しないこと。",
    ].join("\n");
  }

  return [
    "Compass rule:",
    'When state_changed=false, compassText and compassPrompt must both be "".',
    "When state_changed=true, compassText and compassPrompt must both be non-empty.",
    "compassText may be short.",
    "compassPrompt may be short.",
    "However, always prioritize reply and state, and never omit them.",
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
      "最小でも reply / state / compassText / compassPrompt をすべて含めてください。",
      "reply は 1文字以上必須です。",
      "state は必須です。",
      "state を null にしてはいけません。",
    ].join("\n");
  }

  return [
    "Retry instruction:",
    "The previous output was empty.",
    "Do not return an empty string this time.",
    "Return exactly one non-empty JSON object.",
    "At minimum include reply, state, compassText, and compassPrompt.",
    "reply must contain at least 1 character.",
    "state is required.",
    "Do not return state as null.",
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

  return ensureJsonCompletionHasContent(completion);
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

        if (!lowerMessage.includes("empty_json_content")) {
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
Free / Plus / Pro ごとの Compass 出力ルールを system 指示へ載せ、
promptBundle と history から最終 messages を構成し、
completion 実行を安定して OpenAI 呼び出し層へ渡す責務を持つ。
*/

/*
【今回このファイルで修正したこと】
- runJsonForcedCompletion(...) と createPlainCompletion(...) で重複指定されていた temperature: 0.0 を削除しました。
- temperature は phaseParams(...) 側の値だけを使う形にそろえ、TypeScript の重複指定 build error を止めました。
- それ以外の timeout、single retry、empty_json_content 判定、messages 組み立て責務は触っていません。
*/

// このファイルの正式役割: OpenAI へ渡す messages の組み立てと completion 実行制御ファイル