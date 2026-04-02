// /app/api/chat/_lib/route/hopyConfirmedPayload/buildReplyState.ts

import type { ConfirmedAssistantTurn } from "../authenticatedHelpers";

export type HopyReplyState = {
  reply: string;
  state: {
    state_level: number;
    current_phase: number;
    prev_state_level: number;
    prev_phase: number;
    state_changed: boolean;
  };
};

type BuildReplyStateParams = {
  confirmedTurn: ConfirmedAssistantTurn;
};

export function buildReplyState(
  params: BuildReplyStateParams,
): HopyReplyState {
  const { confirmedTurn } = params;

  return {
    reply: confirmedTurn.assistantText,
    state: {
      state_level: confirmedTurn.currentStateLevel,
      current_phase: confirmedTurn.currentPhase,
      prev_state_level: confirmedTurn.prevStateLevel,
      prev_phase: confirmedTurn.prevPhase,
      state_changed: confirmedTurn.stateChanged,
    },
  };
}