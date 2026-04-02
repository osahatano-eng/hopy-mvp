// /app/api/chat/_lib/route/runHopyTurn.ts

import {
  buildChatResponse,
  type ChatResponseShape,
} from "./buildChatResponse";
import {
  buildFailedRunHopyTurnResult,
  finalizeBuiltResult,
  normalizeBuiltResult,
  resolveBuiltResultFailure,
  type RunHopyTurnBuiltResult,
  type RunHopyTurnNotification,
  type RunHopyTurnSpeedAudit,
  type RunHopyTurnState,
  type RunHopyTurnThreadPatch,
} from "./runHopyTurnBuiltResult";

export type RunHopyTurnContext = {
  request: unknown;
  userId?: string | null;
  threadId?: string | null;
  uiLang?: string | null;
};

export type RunHopyTurnPromptInput = unknown;
export type RunHopyTurnModelOutput = unknown;

export type RunHopyTurnDeps = {
  loadContext: (ctx: RunHopyTurnContext) => Promise<unknown>;
  buildPromptInput: (args: {
    ctx: RunHopyTurnContext;
    loadedContext: unknown;
  }) => Promise<RunHopyTurnPromptInput>;
  callModel: (args: {
    ctx: RunHopyTurnContext;
    promptInput: RunHopyTurnPromptInput;
    loadedContext: unknown;
  }) => Promise<RunHopyTurnModelOutput>;
  buildTurnResult: (args: {
    ctx: RunHopyTurnContext;
    promptInput: RunHopyTurnPromptInput;
    modelOutput: RunHopyTurnModelOutput;
    loadedContext: unknown;
  }) => Promise<RunHopyTurnBuiltResult>;
  persistTurn?: (args: {
    ctx: RunHopyTurnContext;
    result: RunHopyTurnBuiltResult;
    loadedContext: unknown;
    promptInput: RunHopyTurnPromptInput;
    modelOutput: RunHopyTurnModelOutput;
  }) => Promise<unknown>;
  persistThreadPatch?: (args: {
    ctx: RunHopyTurnContext;
    threadPatch: RunHopyTurnThreadPatch;
    result: RunHopyTurnBuiltResult;
  }) => Promise<unknown>;
  persistMemories?: (args: {
    ctx: RunHopyTurnContext;
    memoryRows: unknown;
    result: RunHopyTurnBuiltResult;
  }) => Promise<unknown>;
  persistDashboardSignals?: (args: {
    ctx: RunHopyTurnContext;
    dashboardSignalRows: unknown;
    result: RunHopyTurnBuiltResult;
  }) => Promise<unknown>;
  persistExpressionCandidates?: (args: {
    ctx: RunHopyTurnContext;
    expressionCandidateRows: unknown;
    result: RunHopyTurnBuiltResult;
  }) => Promise<unknown>;
};

export type RunHopyTurnInput = {
  ctx: RunHopyTurnContext;
  deps: RunHopyTurnDeps;
};

export type RunHopyTurnOutput = {
  response: ChatResponseShape;
  loadedContext: unknown;
  promptInput: RunHopyTurnPromptInput;
  modelOutput: RunHopyTurnModelOutput;
  result: RunHopyTurnBuiltResult;
};

function ensureDeps(deps: RunHopyTurnDeps): RunHopyTurnDeps {
  if (!deps || typeof deps !== "object") {
    throw new Error("runHopyTurn: deps is required");
  }

  if (typeof deps.loadContext !== "function") {
    throw new Error("runHopyTurn: deps.loadContext is required");
  }

  if (typeof deps.buildPromptInput !== "function") {
    throw new Error("runHopyTurn: deps.buildPromptInput is required");
  }

  if (typeof deps.callModel !== "function") {
    throw new Error("runHopyTurn: deps.callModel is required");
  }

  if (typeof deps.buildTurnResult !== "function") {
    throw new Error("runHopyTurn: deps.buildTurnResult is required");
  }

  return deps;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function resolveResponseCompass(
  result: RunHopyTurnBuiltResult,
):
  | {
      text: string;
      prompt: string;
    }
  | undefined {
  if (result.state?.state_changed !== true) {
    return undefined;
  }

  const compassText = result.compassText;
  if (typeof compassText !== "string") {
    return undefined;
  }

  const compassPrompt = result.compassPrompt;
  if (typeof compassPrompt !== "string") {
    return undefined;
  }

  return {
    text: compassText,
    prompt: compassPrompt,
  };
}

function resolveUpstreamFailure(
  modelOutput: RunHopyTurnModelOutput,
): string | null {
  if (!isRecord(modelOutput)) return null;

  if (modelOutput.openai_ok === false) {
    const rawError = modelOutput.openai_error;
    if (typeof rawError === "string" && rawError.trim().length > 0) {
      return rawError.trim();
    }
    return "runHopyTurn: upstream model failure";
  }

  if (modelOutput.ok === false) {
    const rawError = modelOutput.error;
    if (typeof rawError === "string" && rawError.trim().length > 0) {
      return rawError.trim();
    }
    return "runHopyTurn: upstream failure";
  }

  return null;
}

function extractSpeedAuditFromModelOutput(
  modelOutput: RunHopyTurnModelOutput,
): RunHopyTurnSpeedAudit {
  if (!isRecord(modelOutput)) return null;
  return isRecord(modelOutput.speed_audit) ? modelOutput.speed_audit : null;
}

function resolveSpeedAudit(value: unknown): RunHopyTurnSpeedAudit {
  return isRecord(value) ? value : null;
}

function buildFailedModelOutput(
  error: string,
  speedAudit: RunHopyTurnSpeedAudit = null,
): RunHopyTurnModelOutput {
  return {
    ok: false,
    error,
    openai_ok: false,
    openai_error: error,
    reply: "",
    state: null,
    hopy_confirmed_payload: null,
    compassText: "",
    compassPrompt: "",
    speed_audit: speedAudit,
  };
}

export async function runHopyTurn(
  input: RunHopyTurnInput,
): Promise<RunHopyTurnOutput> {
  const ctx = input?.ctx ?? {};
  const deps = ensureDeps(input?.deps);

  const loadedContext = await deps.loadContext(ctx);

  const promptInput = await deps.buildPromptInput({
    ctx,
    loadedContext,
  });

  const modelOutput = await deps.callModel({
    ctx,
    promptInput,
    loadedContext,
  });

  const upstreamFailure = resolveUpstreamFailure(modelOutput);
  if (upstreamFailure !== null) {
    const speedAudit = extractSpeedAuditFromModelOutput(modelOutput);

    return {
      response: buildChatResponse({
        ok: false,
        error: upstreamFailure,
      }),
      loadedContext,
      promptInput,
      modelOutput: buildFailedModelOutput(upstreamFailure, speedAudit),
      result: buildFailedRunHopyTurnResult(speedAudit),
    };
  }

  const builtResult = await deps.buildTurnResult({
    ctx,
    promptInput,
    modelOutput,
    loadedContext,
  });

  const normalizedResult = normalizeBuiltResult(builtResult);
  const result = finalizeBuiltResult(normalizedResult);

  const builtResultFailure = resolveBuiltResultFailure(result);
  if (builtResultFailure !== null) {
    const speedAudit = resolveSpeedAudit(result.speed_audit);

    return {
      response: buildChatResponse({
        ok: false,
        error: builtResultFailure,
      }),
      loadedContext,
      promptInput,
      modelOutput: buildFailedModelOutput(builtResultFailure, speedAudit),
      result: buildFailedRunHopyTurnResult(speedAudit),
    };
  }

  if (deps.persistTurn) {
    await deps.persistTurn({
      ctx,
      result,
      loadedContext,
      promptInput,
      modelOutput,
    });
  }

  if (deps.persistThreadPatch) {
    await deps.persistThreadPatch({
      ctx,
      threadPatch: result.threadPatch,
      result,
    });
  }

  if (deps.persistMemories) {
    await deps.persistMemories({
      ctx,
      memoryRows: result.memoryRows,
      result,
    });
  }

  if (deps.persistDashboardSignals) {
    await deps.persistDashboardSignals({
      ctx,
      dashboardSignalRows: result.dashboardSignalRows,
      result,
    });
  }

  if (deps.persistExpressionCandidates) {
    await deps.persistExpressionCandidates({
      ctx,
      expressionCandidateRows: result.expressionCandidateRows,
      result,
    });
  }

  const response = buildChatResponse({
    ok: true,
    reply: result.reply,
    state: result.state,
    notification: result.notification,
    thread: result.threadPatch,
    compass: resolveResponseCompass(result),
    debug: result.debug,
  });

  return {
    response,
    loadedContext,
    promptInput,
    modelOutput,
    result,
  };
}

export default runHopyTurn;

/*
このファイルの正式役割
runHopyTurn の共通実行本体。
deps に渡された処理束を順番に実行し、
context 読み込み → promptInput 作成 → model 呼び出し → builtResult 作成 →
builtResult 専用ファイルへ normalize / finalize / validation を委譲 →
persistence → buildChatResponse(...) による response 化
までをまとめる。
*/

/*
【今回このファイルで修正したこと】
- builtResultFailure 分岐で result.speed_audit をそのまま渡さず、resolveSpeedAudit() で Record<string, unknown> | null に絞ってから buildFailedModelOutput() と buildFailedRunHopyTurnResult() に渡すように修正しました。
- これにより、{} | null のままでは通らない RunHopyTurnSpeedAudit の型不一致をこのファイル内で止めました。
- それ以外の runHopyTurn の実行順序、persist 呼び出し、response 組み立ては触っていません。
*/
// このファイルの正式役割: runHopyTurn の共通実行本体

/*
【今回このファイルで修正したこと】
builtResultFailure 分岐で speed_audit を RunHopyTurnSpeedAudit に絞ってから渡すように修正しました。
*/