// /app/api/chat/_lib/route/hopyConfirmedPayload/buildConfirmedMeaningPayload.ts

import {
  normalizeConfirmedMemoryCandidates,
  type ConfirmedMemoryCandidate,
} from "../authenticatedHelpers";
import type { NotificationState } from "../../state/notification";
import {
  resolveFutureChainContextForConfirmedPayload,
  type HopyFutureChainContext,
} from "../../hopy/future-chain/futureChainPayloadContext";
import { buildReplyState } from "./buildReplyState";
import {
  buildThreadSummary,
  type HopyThreadSummary,
} from "./buildThreadSummary";
import {
  buildMemoryCandidates,
  type HopyMemoryCandidate,
} from "./buildMemoryCandidates";
import { buildDashboardSignals } from "./buildDashboardSignals";
import {
  buildNotificationSignal,
  type HopyNotificationSignal,
} from "./buildNotificationSignal";
import {
  buildUiEffects,
  type HopyUiEffects,
} from "./buildUiEffects";

type HopyStateLevel = 1 | 2 | 3 | 4 | 5;

type ConfirmedAssistantTurn = {
  assistantText: string;
  currentPhase: HopyStateLevel;
  currentStateLevel: HopyStateLevel;
  stateChanged: boolean;
  prevPhase: HopyStateLevel;
  prevStateLevel: HopyStateLevel;
  canonicalAssistantState: {
    state_level: HopyStateLevel;
    current_phase: HopyStateLevel;
    state_changed: boolean;
    prev_phase: HopyStateLevel;
    prev_state_level: HopyStateLevel;
  };
  compassText?: unknown;
  compass_text?: unknown;
  compassPrompt?: unknown;
  compass_prompt?: unknown;
  compass?: {
    text?: unknown;
    prompt?: unknown;
  } | null;
};

type MemoryWriteDebug = {
  mem_write_attempted?: boolean | null;
  mem_write_allowed?: boolean | null;
  mem_write_inserted?: number | null;
  mem_write_reason?: string | null;
  mem_items_count?: number | null;
  mem_parse_ok?: boolean | null;
  mem_extract_preview?: unknown;
  mem_used_heuristic?: boolean | null;
};

export type HopyReplyState = ReturnType<typeof buildReplyState>;
export type HopyDashboardSignals = ReturnType<typeof buildDashboardSignals>;

export type HopyConfirmedMeaningPayload = {
  reply: HopyReplyState["reply"];
  state: HopyReplyState["state"];
  compass?: {
    text: string;
    prompt: string | null;
  };
  future_chain_context?: HopyFutureChainContext;
  thread_summary: HopyThreadSummary;
  memory_candidates: HopyMemoryCandidate[];
  dashboard_signals: HopyDashboardSignals;
  notification_signal: HopyNotificationSignal;
  ui_effects: HopyUiEffects;
};

type BuildConfirmedMeaningPayloadParams = {
  confirmedTurn: ConfirmedAssistantTurn;
  resolvedConversationId: string;
  assistantMessageId: string;
  latestReplyAt: string;
  autoTitleUpdated: boolean;
  notification: NotificationState;
  dashboardSignal: unknown;
  supportFocusSignal: unknown;
  memoryWrite: MemoryWriteDebug;
  confirmedMemoryCandidates?: ConfirmedMemoryCandidate[] | null;
  compassText?: unknown;
  compassPrompt?: unknown;
  futureChainContext?: unknown;
};

function resolveConfirmedMeaningMemoryCandidates(params: {
  confirmedMemoryCandidates?: ConfirmedMemoryCandidate[] | null;
  memoryWrite: MemoryWriteDebug;
}): HopyMemoryCandidate[] {
  const normalized = normalizeConfirmedMemoryCandidates(
    params.confirmedMemoryCandidates ?? [],
  );

  if (normalized.length <= 0) {
    return buildMemoryCandidates({
      memoryWrite: params.memoryWrite,
    });
  }

  return normalized as HopyMemoryCandidate[];
}

function normalizeCompassValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function resolveCompassTextValue(params: {
  confirmedTurn: ConfirmedAssistantTurn;
  compassText?: unknown;
}): string {
  const source = params.confirmedTurn as ConfirmedAssistantTurn & {
    compassText?: unknown;
    compass_text?: unknown;
    compass?: {
      text?: unknown;
    } | null;
  };

  return normalizeCompassValue(
    typeof params.compassText === "undefined"
      ? source.compassText ?? source.compass_text ?? source.compass?.text
      : params.compassText,
  );
}

function resolveCompassPromptValue(params: {
  confirmedTurn: ConfirmedAssistantTurn;
  compassPrompt?: unknown;
}): string {
  const source = params.confirmedTurn as ConfirmedAssistantTurn & {
    compassPrompt?: unknown;
    compass_prompt?: unknown;
    compass?: {
      prompt?: unknown;
    } | null;
  };

  return normalizeCompassValue(
    typeof params.compassPrompt === "undefined"
      ? source.compassPrompt ?? source.compass_prompt ?? source.compass?.prompt
      : params.compassPrompt,
  );
}

function resolveConfirmedTurnWithCompass(params: {
  confirmedTurn: ConfirmedAssistantTurn;
  compassText?: unknown;
  compassPrompt?: unknown;
}): ConfirmedAssistantTurn {
  const source = params.confirmedTurn as ConfirmedAssistantTurn & {
    compassText?: unknown;
    compass_text?: unknown;
    compassPrompt?: unknown;
    compass_prompt?: unknown;
    compass?: {
      text?: unknown;
      prompt?: unknown;
    } | null;
  };

  const resolvedCompassText = resolveCompassTextValue({
    confirmedTurn: params.confirmedTurn,
    compassText: params.compassText,
  });

  const resolvedCompassPrompt = resolveCompassPromptValue({
    confirmedTurn: params.confirmedTurn,
    compassPrompt: params.compassPrompt,
  });

  return {
    ...params.confirmedTurn,
    compassText: resolvedCompassText,
    compass_text: resolvedCompassText,
    compassPrompt: resolvedCompassPrompt,
    compass_prompt: resolvedCompassPrompt,
    compass: {
      ...(source.compass ?? {}),
      text: resolvedCompassText,
      prompt: resolvedCompassPrompt,
    },
  } as ConfirmedAssistantTurn;
}

function isCanonicalStateChanged(
  state: HopyReplyState["state"] | null | undefined,
): boolean {
  return state?.state_changed === true;
}

function resolveConfirmedUiEffects(params: {
  confirmedTurn: ConfirmedAssistantTurn;
  stateChanged: boolean;
  compassText?: unknown;
  compassPrompt?: unknown;
}): HopyConfirmedMeaningPayload["ui_effects"] {
  const confirmedTurnWithCompass = resolveConfirmedTurnWithCompass({
    confirmedTurn: params.confirmedTurn,
    compassText: params.stateChanged ? params.compassText : "",
    compassPrompt: params.stateChanged ? params.compassPrompt : "",
  });

  return buildUiEffects({
    confirmedTurn: confirmedTurnWithCompass,
  });
}

export function buildConfirmedMeaningPayload(
  params: BuildConfirmedMeaningPayloadParams,
): HopyConfirmedMeaningPayload {
  const {
    confirmedTurn,
    resolvedConversationId,
    assistantMessageId,
    latestReplyAt,
    autoTitleUpdated,
    notification,
    dashboardSignal,
    supportFocusSignal,
    memoryWrite,
    confirmedMemoryCandidates,
    compassText,
    compassPrompt,
    futureChainContext,
  } = params;

  const replyState = buildReplyState({
    confirmedTurn,
  });
  const canonicalStateChanged = isCanonicalStateChanged(replyState.state);

  const future_chain_context = resolveFutureChainContextForConfirmedPayload({
    rawContext: futureChainContext,
    stateChanged: canonicalStateChanged,
  });

  const thread_summary = buildThreadSummary({
    confirmedTurn,
    resolvedConversationId,
    assistantMessageId,
    latestReplyAt,
    autoTitleUpdated,
  });

  const memory_candidates = resolveConfirmedMeaningMemoryCandidates({
    confirmedMemoryCandidates,
    memoryWrite,
  });

  const dashboard_signals = buildDashboardSignals({
    dashboardSignal,
    supportFocusSignal,
  });

  const notification_signal = buildNotificationSignal({
    notification,
  });

  const ui_effects = resolveConfirmedUiEffects({
    confirmedTurn,
    stateChanged: canonicalStateChanged,
    compassText,
    compassPrompt,
  });

  const resolvedCompassText = resolveCompassTextValue({
    confirmedTurn,
    compassText,
  });

  const resolvedCompassPrompt = resolveCompassPromptValue({
    confirmedTurn,
    compassPrompt,
  });

  return {
    reply: replyState.reply,
    state: replyState.state,
    ...(canonicalStateChanged && resolvedCompassText.length > 0
      ? {
          compass: {
            text: resolvedCompassText,
            prompt:
              resolvedCompassPrompt.length > 0 ? resolvedCompassPrompt : null,
          },
        }
      : {}),
    ...(future_chain_context
      ? {
          future_chain_context,
        }
      : {}),
    thread_summary,
    memory_candidates,
    dashboard_signals,
    notification_signal,
    ui_effects,
  };
}

export default buildConfirmedMeaningPayload;

/*
【このファイルの正式役割】
hopy_confirmed_payload の正式組み立てファイル。
confirmedTurn と各補助情報を受けて、
reply / state / compass / future_chain_context / thread_summary /
memory_candidates / dashboard_signals / notification_signal / ui_effects を
唯一の正に沿って組み立てる。

このファイルは Compass を新規生成しない。
このファイルは Future Chain の4項目やカテゴリ意味を新規生成しない。
このファイルは Future Chain の型定義・正規化・保存判定を持たない。
Future Chain 関連は専用ファイルで正規化された結果だけを
hopy_confirmed_payload の正式shapeへ載せる。

【今回このファイルで修正したこと】
- Future Chain v3 の型定義をこのファイルから削除しました。
- Future Chain v3 の正規化関数をこのファイルから削除しました。
- confirmedTurn.futureChainContext / confirmedTurn.future_chain_context へのfallback読み取りを削除しました。
- futureChainContext は params.futureChainContext だけを受け取り、Future Chain専用resolverへ渡す形にしました。
- hopy_confirmed_payload 組み立てファイルは、Future Chainの中身を持たず、中継だけを担当する形へ戻しました。

/app/api/chat/_lib/route/hopyConfirmedPayload/buildConfirmedMeaningPayload.ts
*/