// /app/api/chat/_lib/route/openai.ts
import OpenAI from "openai";

import type { Lang } from "../router/simpleRouter";
import type { PromptBundle } from "./promptBundle";
import { extractAssistantReplyPayload } from "./openaiParsing";
import {
  detectResolvedPlanFromPromptBundle,
  getReplyMaxTokensByPlan,
  type ResolvedPlanLike,
} from "./openaiPlan";
import {
  buildOpenAIMessages,
  createJsonForcedCompletion,
  type HistoryItem,
} from "./openaiExecution";

type GenerateAssistantReplyParams = {
  openai: OpenAI;
  modelName: string;
  promptBundle: PromptBundle;
  history: HistoryItem[];
  userText: string;
  replyLang: Lang;
  phaseForParams: 1 | 2 | 3 | 4 | 5;
  openaiTimeoutMs: number;
};

type ConfirmedPayloadState = {
  current_phase: 1 | 2 | 3 | 4 | 5;
  state_level: 1 | 2 | 3 | 4 | 5;
  prev_phase: 1 | 2 | 3 | 4 | 5;
  prev_state_level: 1 | 2 | 3 | 4 | 5;
  state_changed: boolean;
};

type SpeedAudit = {
  openai_total_ms: number;
  openai_json_first_ms: number;
  openai_json_second_ms: number;
  openai_plain_ms: number;
  openai_memory_recovery_ms: number;
  state_resolve_ms: number;
  confirmed_payload_build_ms: number;
  compass_resolve_ms: number;
  memory_candidates_resolve_ms: number;
  json_retry_count: number;
  plain_used: boolean;
  empty_json_retry_used: boolean;
};

type GenerateAssistantReplyResult = {
  assistantText: string;
  openai_ok: boolean;
  openai_error: string | null;
  confirmed_memory_candidates: unknown[];
  compassText: string;
  compassPrompt: string;
  state: Record<string, unknown> | null;
  hopy_confirmed_payload?: {
    reply: string;
    state: ConfirmedPayloadState;
    compass?: {
      text: string;
      prompt: string;
    };
    future_chain_context?: Record<string, unknown>;
  };
  speed_audit: SpeedAudit;
};

type ExtractedReplyPayload = {
  assistantText: string;
  confirmed_memory_candidates: unknown[];
  parsed_json: unknown;
  compassText: string;
  compassPrompt: string;
  state: Record<string, unknown> | null;
  futureChainContext: Record<string, unknown> | null;
};

type AttemptDebugInfo = {
  source: "json_first" | "json_second";
  rawPreview: string;
  parsedJsonKind: "object" | "null" | "other";
  hasAssistantText: boolean;
  hasCanonicalState: boolean;
  hasCompassText: boolean;
  hasCompassPrompt: boolean;
};

function nowMs(): number {
  return Date.now();
}

function elapsedMs(startMs: number): number {
  return Math.max(0, nowMs() - startMs);
}

function createInitialSpeedAudit(): SpeedAudit {
  return {
    openai_total_ms: 0,
    openai_json_first_ms: 0,
    openai_json_second_ms: 0,
    openai_plain_ms: 0,
    openai_memory_recovery_ms: 0,
    state_resolve_ms: 0,
    confirmed_payload_build_ms: 0,
    compass_resolve_ms: 0,
    memory_candidates_resolve_ms: 0,
    json_retry_count: 0,
    plain_used: false,
    empty_json_retry_used: false,
  };
}

function normalizeCompassString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeAssistantText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasChoicesCompletion(
  value: unknown,
): value is {
  choices?: Array<{
    message?: {
      content?: string | null;
    } | null;
  }>;
} {
  return isRecord(value) && "choices" in value;
}

function getCompletionMessageContent(value: unknown): string {
  if (!hasChoicesCompletion(value)) return "";
  return String(value.choices?.[0]?.message?.content ?? "");
}

function normalizeStateValue(value: unknown): 1 | 2 | 3 | 4 | 5 | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 5) return null;
  return value as 1 | 2 | 3 | 4 | 5;
}

function resolveCanonicalState(
  state: Record<string, unknown> | null,
): ConfirmedPayloadState | null {
  if (!isRecord(state)) return null;

  const currentPhase = normalizeStateValue(state.current_phase);
  const stateLevel = normalizeStateValue(state.state_level);
  const prevPhase = normalizeStateValue(state.prev_phase);
  const prevStateLevel = normalizeStateValue(state.prev_state_level);
  const stateChanged = state.state_changed;

  if (
    currentPhase === null ||
    stateLevel === null ||
    prevPhase === null ||
    prevStateLevel === null ||
    typeof stateChanged !== "boolean"
  ) {
    return null;
  }

  return {
    current_phase: currentPhase,
    state_level: stateLevel,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    state_changed: stateChanged,
  };
}

function hasRequiredCanonicalState(
  state: Record<string, unknown> | null,
): boolean {
  return resolveCanonicalState(state) !== null;
}

function isStateChangedTrue(state: Record<string, unknown> | null): boolean {
  return state?.state_changed === true;
}

function isCompassRequiredForPlan(params: {
  resolvedPlan: ResolvedPlanLike;
  state: Record<string, unknown> | null;
}): boolean {
  const { resolvedPlan, state } = params;
  if (resolvedPlan === "free") return false;
  return isStateChangedTrue(state);
}

function shouldRetryWithStructuredForMissingState(params: {
  parsedJson: unknown;
  state: Record<string, unknown> | null;
}): boolean {
  const { parsedJson, state } = params;
  if (!isRecord(parsedJson)) return false;
  return !hasRequiredCanonicalState(state);
}

function shouldRetryWithStructuredForMissingCompass(params: {
  resolvedPlan: ResolvedPlanLike;
  state: Record<string, unknown> | null;
  compassText: string;
  compassPrompt: string;
}): boolean {
  const { resolvedPlan, state, compassText, compassPrompt } = params;

  if (!hasRequiredCanonicalState(state)) return false;
  if (
    !isCompassRequiredForPlan({
      resolvedPlan,
      state,
    })
  ) {
    return false;
  }

  return !compassText.trim() || !compassPrompt.trim();
}

function buildMissingRequiredCompassErrorMessage(params: {
  resolvedPlan: ResolvedPlanLike;
  state: Record<string, unknown> | null;
  compassText: string;
  compassPrompt: string;
}): string {
  const canonicalState = resolveCanonicalState(params.state);

  return [
    "openai.ts: compass is required before returning model output",
    `resolvedPlan=${String(params.resolvedPlan || "unknown")}`,
    `state_changed=${canonicalState?.state_changed === true ? "true" : "false"}`,
    `hasCompassText=${params.compassText.trim() ? "true" : "false"}`,
    `hasCompassPrompt=${params.compassPrompt.trim() ? "true" : "false"}`,
  ].join(" | ");
}

function buildConfirmedPayload(params: {
  assistantText: string;
  state: Record<string, unknown> | null;
  compassText: string;
  compassPrompt: string;
  resolvedPlan: ResolvedPlanLike;
  futureChainContext: Record<string, unknown> | null;
}): GenerateAssistantReplyResult["hopy_confirmed_payload"] {
  const {
    assistantText,
    state,
    compassText,
    compassPrompt,
    resolvedPlan,
    futureChainContext,
  } = params;

  const canonicalState = resolveCanonicalState(state);
  if (!canonicalState) return undefined;
  if (!assistantText.trim()) return undefined;

  const compassRequiredForPlan = isCompassRequiredForPlan({
    resolvedPlan,
    state,
  });

  if (compassRequiredForPlan) {
    if (!compassText.trim() || !compassPrompt.trim()) {
      return undefined;
    }
  }

  const payload: NonNullable<
    GenerateAssistantReplyResult["hopy_confirmed_payload"]
  > = {
    reply: assistantText,
    state: canonicalState,
  };

  if (compassRequiredForPlan) {
    payload.compass = {
      text: compassText.trim(),
      prompt: compassPrompt.trim(),
    };
  }

  if (futureChainContext) {
    payload.future_chain_context = futureChainContext;
  }

  return payload;
}

function selectPreferredState(params: {
  primary: Record<string, unknown> | null;
  fallback: Record<string, unknown> | null;
}): Record<string, unknown> | null {
  const { primary, fallback } = params;
  if (hasRequiredCanonicalState(primary)) return primary;
  if (hasRequiredCanonicalState(fallback)) return fallback;
  return null;
}

function selectPreferredCompassString(params: {
  primary: string;
  fallback: string;
}): string {
  const { primary, fallback } = params;
  if (primary.trim()) return primary.trim();
  return fallback.trim();
}

function selectPreferredAssistantText(params: {
  primary: string;
  fallback: string;
}): string {
  const { primary, fallback } = params;
  if (primary.trim()) return primary.trim();
  return fallback.trim();
}

function selectPreferredMemoryCandidates(params: {
  primary: unknown[];
  fallback: unknown[];
}): unknown[] {
  const { primary, fallback } = params;
  if (Array.isArray(primary) && primary.length > 0) return primary;
  if (Array.isArray(fallback) && fallback.length > 0) return fallback;
  return [];
}

function selectPreferredFutureChainContext(params: {
  primary: Record<string, unknown> | null;
  fallback: Record<string, unknown> | null;
}): Record<string, unknown> | null {
  const { primary, fallback } = params;
  if (isRecord(primary)) return primary;
  if (isRecord(fallback)) return fallback;
  return null;
}

function extractCanonicalStateFromUnknown(
  value: unknown,
): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const canonical = resolveCanonicalState(value);
  if (!canonical) return null;

  return {
    current_phase: canonical.current_phase,
    state_level: canonical.state_level,
    prev_phase: canonical.prev_phase,
    prev_state_level: canonical.prev_state_level,
    state_changed: canonical.state_changed,
  };
}

function recoverConfirmedPayloadFromParsedJson(
  parsedJson: unknown,
): Record<string, unknown> | null {
  if (!isRecord(parsedJson)) return null;

  const payload = parsedJson.hopy_confirmed_payload;
  if (!isRecord(payload)) return null;

  return payload;
}

function recoverAssistantTextFromParsedJson(parsedJson: unknown): string {
  const payload = recoverConfirmedPayloadFromParsedJson(parsedJson);
  if (!payload) return "";
  return normalizeAssistantText(payload.reply);
}

function recoverStateFromParsedJson(
  parsedJson: unknown,
): Record<string, unknown> | null {
  const payload = recoverConfirmedPayloadFromParsedJson(parsedJson);
  if (!payload) return null;

  return extractCanonicalStateFromUnknown(payload.state);
}

function recoverCompassFromParsedJson(parsedJson: unknown): {
  text: string;
  prompt: string;
} {
  const payload = recoverConfirmedPayloadFromParsedJson(parsedJson);
  if (!payload) {
    return { text: "", prompt: "" };
  }

  const compass = payload.compass;
  if (!isRecord(compass)) {
    return { text: "", prompt: "" };
  }

  return {
    text: normalizeCompassString(compass.text),
    prompt: normalizeCompassString(compass.prompt),
  };
}

function recoverFutureChainContextFromParsedJson(
  parsedJson: unknown,
): Record<string, unknown> | null {
  const payload = recoverConfirmedPayloadFromParsedJson(parsedJson);
  if (!payload) return null;

  return isRecord(payload.future_chain_context)
    ? payload.future_chain_context
    : null;
}

function recoverMemoryCandidatesFromParsedJson(parsedJson: unknown): unknown[] {
  if (!isRecord(parsedJson)) return [];
  return Array.isArray(parsedJson.confirmed_memory_candidates)
    ? parsedJson.confirmed_memory_candidates
    : [];
}

function buildExtractedPayloadFromRawContent(
  rawContent: string,
): ExtractedReplyPayload {
  const extracted = extractAssistantReplyPayload(rawContent);
  const canonicalAssistantText = recoverAssistantTextFromParsedJson(
    extracted.parsed_json,
  );
  const canonicalState = recoverStateFromParsedJson(extracted.parsed_json);
  const canonicalCompass = recoverCompassFromParsedJson(extracted.parsed_json);
  const canonicalFutureChainContext = recoverFutureChainContextFromParsedJson(
    extracted.parsed_json,
  );
  const canonicalMemoryCandidates = recoverMemoryCandidatesFromParsedJson(
    extracted.parsed_json,
  );

  return {
    assistantText: canonicalAssistantText,
    confirmed_memory_candidates: canonicalMemoryCandidates,
    parsed_json: extracted.parsed_json,
    compassText: canonicalCompass.text,
    compassPrompt: canonicalCompass.prompt,
    state: canonicalState,
    futureChainContext: canonicalFutureChainContext,
  };
}

function mergeExtractedPayloads(params: {
  primary: ExtractedReplyPayload;
  fallback: ExtractedReplyPayload;
}): ExtractedReplyPayload {
  const { primary, fallback } = params;

  return {
    assistantText: selectPreferredAssistantText({
      primary: primary.assistantText,
      fallback: fallback.assistantText,
    }),
    confirmed_memory_candidates: selectPreferredMemoryCandidates({
      primary: primary.confirmed_memory_candidates,
      fallback: fallback.confirmed_memory_candidates,
    }),
    parsed_json: primary.parsed_json,
    compassText: selectPreferredCompassString({
      primary: primary.compassText,
      fallback: fallback.compassText,
    }),
    compassPrompt: selectPreferredCompassString({
      primary: primary.compassPrompt,
      fallback: fallback.compassPrompt,
    }),
    state: selectPreferredState({
      primary: primary.state,
      fallback: fallback.state,
    }),
    futureChainContext: selectPreferredFutureChainContext({
      primary: primary.futureChainContext,
      fallback: fallback.futureChainContext,
    }),
  };
}

function previewRawContent(rawContent: string): string {
  return String(rawContent ?? "").trim().slice(0, 500);
}

function detectParsedJsonKind(value: unknown): "object" | "null" | "other" {
  if (value === null || value === undefined) return "null";
  if (isRecord(value)) return "object";
  return "other";
}

function buildAttemptDebugInfo(params: {
  source: AttemptDebugInfo["source"];
  rawContent: string;
  extracted: ExtractedReplyPayload;
}): AttemptDebugInfo {
  const { source, rawContent, extracted } = params;

  return {
    source,
    rawPreview: previewRawContent(rawContent),
    parsedJsonKind: detectParsedJsonKind(extracted.parsed_json),
    hasAssistantText: extracted.assistantText.trim().length > 0,
    hasCanonicalState: hasRequiredCanonicalState(extracted.state),
    hasCompassText: extracted.compassText.trim().length > 0,
    hasCompassPrompt: extracted.compassPrompt.trim().length > 0,
  };
}

function buildMissingStateErrorMessage(params: {
  attempts: AttemptDebugInfo[];
}): string {
  const detail = params.attempts
    .map((attempt) =>
      [
        `source=${attempt.source}`,
        `parsedJsonKind=${attempt.parsedJsonKind}`,
        `hasAssistantText=${attempt.hasAssistantText}`,
        `hasCanonicalState=${attempt.hasCanonicalState}`,
        `hasCompassText=${attempt.hasCompassText}`,
        `hasCompassPrompt=${attempt.hasCompassPrompt}`,
        `rawPreview=${JSON.stringify(attempt.rawPreview)}`,
      ].join(" | "),
    )
    .join(" || ");

  return `openai.ts: state is required before returning model output :: ${detail}`;
}

export function safeFallbackReply(uiLang: Lang): string {
  if (uiLang === "en") {
    return [
      "Sorry — I ran out of time generating that response.",
      "If you resend your last message once, I’ll answer cleanly from there.",
      "You’re not alone in this.",
    ].join("\n");
  }

  return [
    "ごめんなさい、返答の生成が間に合いませんでした。",
    "直前のメッセージをもう一度送ってくれたら、そこから整えて返します。",
    "大丈夫、ここにいます。",
  ].join("\n");
}

export async function generateAssistantReply(
  params: GenerateAssistantReplyParams,
): Promise<GenerateAssistantReplyResult> {
  const {
    openai,
    modelName,
    promptBundle,
    history,
    userText,
    replyLang,
    phaseForParams,
    openaiTimeoutMs,
  } = params;

  let assistantText = "";
  let openai_ok = false;
  let openai_error: string | null = null;
  let confirmed_memory_candidates: unknown[] = [];
  let compassText = "";
  let compassPrompt = "";
  let state: Record<string, unknown> | null = null;
  let futureChainContext: Record<string, unknown> | null = null;
  let resolvedPlan: ResolvedPlanLike = "free";
  const attemptDebugInfos: AttemptDebugInfo[] = [];
  const speed_audit = createInitialSpeedAudit();

  const openaiTotalStartMs = nowMs();

  try {
    resolvedPlan = detectResolvedPlanFromPromptBundle(promptBundle);
    const messages = buildOpenAIMessages({
      promptBundle,
      history,
      userText,
      replyLang,
      resolvedPlan,
    });
    const replyMaxTokens = getReplyMaxTokensByPlan(resolvedPlan);

    let completion: Awaited<ReturnType<typeof createJsonForcedCompletion>>;
    let selectedExtracted: ExtractedReplyPayload | null = null;

    const jsonFirstStartMs = nowMs();
    completion = await createJsonForcedCompletion({
      openai,
      modelName,
      messages,
      phaseForParams,
      openaiTimeoutMs,
      maxTokens: replyMaxTokens,
      replyLang,
    });
    speed_audit.openai_json_first_ms = elapsedMs(jsonFirstStartMs);

    const firstJsonRawContent = getCompletionMessageContent(completion);

    const firstStateResolveStartMs = nowMs();
    const firstJsonExtracted = buildExtractedPayloadFromRawContent(
      firstJsonRawContent,
    );
    speed_audit.state_resolve_ms += elapsedMs(firstStateResolveStartMs);

    attemptDebugInfos.push(
      buildAttemptDebugInfo({
        source: "json_first",
        rawContent: firstJsonRawContent,
        extracted: firstJsonExtracted,
      }),
    );

    selectedExtracted = firstJsonExtracted;

    const firstCompassResolveStartMs = nowMs();
    const needsStructuredRetry =
      shouldRetryWithStructuredForMissingState({
        parsedJson: firstJsonExtracted.parsed_json,
        state: firstJsonExtracted.state,
      }) ||
      shouldRetryWithStructuredForMissingCompass({
        resolvedPlan,
        state: firstJsonExtracted.state,
        compassText: firstJsonExtracted.compassText,
        compassPrompt: firstJsonExtracted.compassPrompt,
      });
    speed_audit.compass_resolve_ms += elapsedMs(firstCompassResolveStartMs);

    if (needsStructuredRetry) {
      speed_audit.json_retry_count = 1;

      const jsonSecondStartMs = nowMs();
      completion = await createJsonForcedCompletion({
        openai,
        modelName,
        messages,
        phaseForParams,
        openaiTimeoutMs,
        maxTokens: replyMaxTokens,
        replyLang,
      });
      speed_audit.openai_json_second_ms = elapsedMs(jsonSecondStartMs);

      const secondJsonRawContent = getCompletionMessageContent(completion);

      const secondStateResolveStartMs = nowMs();
      const secondJsonExtracted = buildExtractedPayloadFromRawContent(
        secondJsonRawContent,
      );
      speed_audit.state_resolve_ms += elapsedMs(secondStateResolveStartMs);

      attemptDebugInfos.push(
        buildAttemptDebugInfo({
          source: "json_second",
          rawContent: secondJsonRawContent,
          extracted: secondJsonExtracted,
        }),
      );

      selectedExtracted = mergeExtractedPayloads({
        primary: secondJsonExtracted,
        fallback: firstJsonExtracted,
      });
    }

    if (!selectedExtracted) {
      throw new Error(
        "openai.ts: extracted payload is required before returning model output",
      );
    }

    const extracted = selectedExtracted;

    assistantText = normalizeAssistantText(extracted.assistantText);
    futureChainContext = extracted.futureChainContext;

    const memoryCandidatesResolveStartMs = nowMs();
    confirmed_memory_candidates = extracted.confirmed_memory_candidates;
    speed_audit.memory_candidates_resolve_ms = elapsedMs(
      memoryCandidatesResolveStartMs,
    );

    const compassResolveStartMs = nowMs();
    compassText = normalizeCompassString(extracted.compassText);
    compassPrompt = normalizeCompassString(extracted.compassPrompt);
    speed_audit.compass_resolve_ms += elapsedMs(compassResolveStartMs);

    const finalStateResolveStartMs = nowMs();
    state = extracted.state ?? null;
    const hasCanonicalState = hasRequiredCanonicalState(state);
    speed_audit.state_resolve_ms += elapsedMs(finalStateResolveStartMs);

    if (!assistantText.trim()) {
      throw new Error(
        "openai.ts: assistantText is required before returning model output",
      );
    }

    if (!hasCanonicalState) {
      throw new Error(
        buildMissingStateErrorMessage({
          attempts: attemptDebugInfos,
        }),
      );
    }

    const requiredCompassResolveStartMs = nowMs();
    const compassRequiredForPlan = isCompassRequiredForPlan({
      resolvedPlan,
      state,
    });
    speed_audit.compass_resolve_ms += elapsedMs(requiredCompassResolveStartMs);

    if (!compassRequiredForPlan) {
      compassText = "";
      compassPrompt = "";
    }

    if (
      compassRequiredForPlan &&
      (!compassText.trim() || !compassPrompt.trim())
    ) {
      throw new Error(
        buildMissingRequiredCompassErrorMessage({
          resolvedPlan,
          state,
          compassText,
          compassPrompt,
        }),
      );
    }

    openai_ok = true;
    openai_error = null;
  } catch (e: unknown) {
    openai_error = String(e ?? "");
    openai_ok = false;

    assistantText = "";
    confirmed_memory_candidates = [];
    compassText = "";
    compassPrompt = "";
    state = null;
    futureChainContext = null;
  }

  speed_audit.openai_total_ms = elapsedMs(openaiTotalStartMs);

  const confirmedPayloadBuildStartMs = nowMs();
  const hopy_confirmed_payload = openai_ok
    ? buildConfirmedPayload({
        assistantText,
        state,
        compassText,
        compassPrompt,
        resolvedPlan,
        futureChainContext,
      })
    : undefined;
  speed_audit.confirmed_payload_build_ms = elapsedMs(
    confirmedPayloadBuildStartMs,
  );

  return {
    assistantText,
    openai_ok,
    openai_error,
    confirmed_memory_candidates,
    compassText,
    compassPrompt,
    state,
    hopy_confirmed_payload,
    speed_audit,
  };
}

export default generateAssistantReply;

/*
【このファイルの正式役割】
OpenAI 応答の生成・回収ファイル。
promptBundle と history から messages を作る前提で、
JSON強制生成を試し、
返ってきた内容から assistantText / confirmed_memory_candidates /
compassText / compassPrompt / state / futureChainContext を回収して返す。
このファイルは独自に状態変化や Compass や Future Chain を再判定する層ではなく、
確定意味ペイロードから正式値だけを回収して次段へ渡す生成結果回収責務を持つ。

【今回このファイルで修正したこと】
- needsStructuredRetry から Future Chain context 不足時 retry 判定を削除しました。
- このファイルの retry 対象を state / Compass 不足だけに戻しました。
- future_chain_context は、モデルが返した場合のみ回収して次段へ渡します。
- Future Chain の意味生成、state_changed 再判定、Compass 判定、HOPY回答○判定、DB保存、UI表示はこのファイルでは行っていません。

/app/api/chat/_lib/route/openai.ts
*/