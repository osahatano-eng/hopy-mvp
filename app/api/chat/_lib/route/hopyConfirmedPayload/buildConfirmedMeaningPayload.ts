// /app/api/chat/_lib/route/hopyConfirmedPayload/buildConfirmedMeaningPayload.ts

import {
  normalizeConfirmedMemoryCandidates,
  type ConfirmedAssistantTurn,
  type ConfirmedMemoryCandidate,
  type MemoryWriteDebug,
} from "../authenticatedHelpers";
import type { NotificationState } from "../../state/notification";
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

export type HopyReplyState = ReturnType<typeof buildReplyState>;
export type HopyDashboardSignals = ReturnType<typeof buildDashboardSignals>;

export type HopyConfirmedMeaningPayload = {
  reply: HopyReplyState["reply"];
  state: HopyReplyState["state"];
  compass?: {
    text: string;
    prompt: string | null;
  };
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
      ? source.compassText ??
          source.compass_text ??
          source.compass?.text
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
      ? source.compassPrompt ??
          source.compass_prompt ??
          source.compass?.prompt
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

function resolveConfirmedUiEffects(params: {
  confirmedTurn: ConfirmedAssistantTurn;
  compassText?: unknown;
  compassPrompt?: unknown;
}): HopyConfirmedMeaningPayload["ui_effects"] {
  const confirmedTurnWithCompass = resolveConfirmedTurnWithCompass({
    confirmedTurn: params.confirmedTurn,
    compassText: params.compassText,
    compassPrompt: params.compassPrompt,
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
  } = params;

  const replyState = buildReplyState({
    confirmedTurn,
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
    ...(resolvedCompassText.length > 0
      ? {
          compass: {
            text: resolvedCompassText,
            prompt:
              resolvedCompassPrompt.length > 0 ? resolvedCompassPrompt : null,
          },
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
このファイルの正式役割
hopy_confirmed_payload の正式組み立てファイル。
confirmedTurn と各補助情報を受けて、
reply / state / compass / thread_summary / memory_candidates /
dashboard_signals / notification_signal / ui_effects を
唯一の正に沿って組み立てる。

このファイルは Compass を新規生成しない。
受け取った confirmedTurn / compassText / compassPrompt を正規化して
hopy_confirmed_payload の正式shapeへ載せる。
*/

/*
【今回このファイルで修正したこと】
- HopyConfirmedMeaningPayload の正式shapeに top-level の compass を追加した。
- buildConfirmedMeaningPayload(...) の return に top-level の compass を追加した。
- これにより authenticatedFinalize.ts が payload.hopy_confirmed_payload を上書きしても、
  hopy_confirmed_payload.compass が欠けないようにした。
*/
// このファイルの正式役割: hopy_confirmed_payload の正式組み立てファイル