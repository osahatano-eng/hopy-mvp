// /app/api/chat/_lib/route/hopyConfirmedPayload/buildThreadSummary.ts

import type { ConfirmedAssistantTurn } from "../authenticatedHelpers";
import type { HopyReplyState } from "./buildConfirmedMeaningPayload";

export type HopyThreadSummary = {
  thread_id: string;
  latest_reply_id: string;
  latest_reply_at: string;
  latest_confirmed_state: HopyReplyState["state"];
  title_candidate_updated: boolean;
};

type BuildThreadSummaryParams = {
  confirmedTurn: ConfirmedAssistantTurn;
  resolvedConversationId: string;
  assistantMessageId: string;
  latestReplyAt: string;
  autoTitleUpdated: boolean;
};

export function buildThreadSummary(
  params: BuildThreadSummaryParams,
): HopyThreadSummary {
  const {
    confirmedTurn,
    resolvedConversationId,
    assistantMessageId,
    latestReplyAt,
    autoTitleUpdated,
  } = params;

  return {
    thread_id: resolvedConversationId,
    latest_reply_id: assistantMessageId,
    latest_reply_at: latestReplyAt,
    latest_confirmed_state: {
      state_level: confirmedTurn.currentStateLevel,
      current_phase: confirmedTurn.currentPhase,
      prev_state_level: confirmedTurn.prevStateLevel,
      prev_phase: confirmedTurn.prevPhase,
      state_changed: confirmedTurn.stateChanged,
    },
    title_candidate_updated: autoTitleUpdated,
  };
}