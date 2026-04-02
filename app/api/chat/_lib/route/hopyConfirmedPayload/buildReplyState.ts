// /app/api/chat/_lib/route/hopyConfirmedPayload/buildReplyState.ts

type ConfirmedAssistantTurn = {
  assistantText: string;
  currentStateLevel: 1 | 2 | 3 | 4 | 5;
  currentPhase: 1 | 2 | 3 | 4 | 5;
  prevStateLevel: 1 | 2 | 3 | 4 | 5;
  prevPhase: 1 | 2 | 3 | 4 | 5;
  stateChanged: boolean;
};

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

/*
このファイルの正式役割:
hopy_confirmed_payload 用の reply/state を confirmedTurn から最小構成で組み立てる専用ファイル

【今回このファイルで修正したこと】
authenticatedHelpers.ts から export されていない ConfirmedAssistantTurn の import を削除しました。
このファイル内で buildReplyState に必要な最小限の ConfirmedAssistantTurn 型を定義しました。
reply/state の組み立てロジック自体は変更していません。
*/