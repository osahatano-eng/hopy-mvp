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

type RunHopyTurnResponseConfirmedPayload = NonNullable<
  Parameters<typeof buildChatResponse>[0]["hopy_confirmed_payload"]
>;

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

function resolveConfirmedPayloadRecord(
  result: RunHopyTurnBuiltResult,
): Record<string, unknown> | null {
  if (!isRecord(result)) return null;

  const payload = result.hopy_confirmed_payload;
  return isRecord(payload) ? payload : null;
}

function resolveResponseConfirmedPayload(
  result: RunHopyTurnBuiltResult,
): RunHopyTurnResponseConfirmedPayload | null {
  const confirmedPayload = resolveConfirmedPayloadRecord(result);
  if (!confirmedPayload) {
    return null;
  }

  const rawState = isRecord(confirmedPayload.state)
    ? confirmedPayload.state
    : null;
  const rawCompass = isRecord(confirmedPayload.compass)
    ? confirmedPayload.compass
    : null;

  return {
    reply: confirmedPayload.reply,
    state: rawState
      ? {
          current_phase: rawState.current_phase,
          state_level: rawState.state_level,
          prev_phase: rawState.prev_phase,
          prev_state_level: rawState.prev_state_level,
          state_changed: rawState.state_changed,
          label: rawState.label,
          prev_label: rawState.prev_label,
        }
      : null,
    compass: rawCompass
      ? {
          text: rawCompass.text,
          prompt: rawCompass.prompt,
        }
      : null,
  };
}

function resolveResponseState(
  result: RunHopyTurnBuiltResult,
): RunHopyTurnState {
  const confirmedPayload = resolveConfirmedPayloadRecord(result);
  const confirmedState = confirmedPayload?.state;

  if (isRecord(confirmedState)) {
    return confirmedState as RunHopyTurnState;
  }

  return null;
}

function resolveResponseCompass(
  result: RunHopyTurnBuiltResult,
):
  | {
      text: string;
      prompt: string;
    }
  | undefined {
  const confirmedPayload = resolveConfirmedPayloadRecord(result);
  if (!confirmedPayload) {
    return undefined;
  }

  const confirmedState = confirmedPayload.state;
  if (!isRecord(confirmedState) || confirmedState.state_changed !== true) {
    return undefined;
  }

  const confirmedCompass = confirmedPayload.compass;
  if (!isRecord(confirmedCompass)) {
    return undefined;
  }

  const compassText =
    typeof confirmedCompass.text === "string"
      ? confirmedCompass.text.trim()
      : "";
  if (!compassText) {
    return undefined;
  }

  const compassPrompt =
    typeof confirmedCompass.prompt === "string"
      ? confirmedCompass.prompt.trim()
      : "";
  if (!compassPrompt) {
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

  if (deps.persistThreadPatch && result.threadPatch) {
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
    hopy_confirmed_payload: resolveResponseConfirmedPayload(result),
    reply: result.reply,
    state: resolveResponseState(result),
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

この層は HOPY回答○ の唯一の正を新規生成しない。
response 化では、hopy_confirmed_payload.state と
hopy_confirmed_payload.compass を唯一の正としてそのまま載せる。
*/

/*
【今回このファイルで修正したこと】
- buildChatResponse(...) が要求する hopy_confirmed_payload 用の型に合わせるため、response 用の resolveResponseConfirmedPayload(...) を追加しました。
- 成功系の buildChatResponse(...) には result.hopy_confirmed_payload をそのまま渡さず、このファイル内で shape を崩さずに狭めた値だけを渡すようにしました。
- state_changed の再計算、Compass の fallback 補完、HOPY唯一の正の作り直しはしていません。
*/

/* /app/api/chat/_lib/route/runHopyTurn.ts */
// このファイルの正式役割: runHopyTurn の共通実行本体