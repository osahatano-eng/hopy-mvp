// /components/chat/lib/chatSendApplyUserState.ts
"use client";

type ChatSendUserStateSource = {
  hasConfirmedState: boolean;
  hasLegacyState: boolean;
  confirmedPayload?: {
    state?: unknown;
  } | null;
  normalizedAssistantState?: unknown;
  payload: {
    state?: unknown;
  };
};

export function applyUserStateFromSendResult<TState>(args: {
  executed: ChatSendUserStateSource;
  normalizeState: (s: unknown) => TState | null;
  setUserState: (s: TState | null) => void;
}) {
  const { executed, normalizeState, setUserState } = args;

  if (!executed.hasConfirmedState && !executed.hasLegacyState) {
    return;
  }

  const sourceState = executed.hasConfirmedState
    ? executed.confirmedPayload?.state
    : executed.normalizedAssistantState ?? executed.payload.state;

  const normalized = normalizeState(sourceState);
  setUserState(normalized);
}

/*
このファイルの正式役割
useChatSend 親ファイルから分離した、送信後の userState 反映責務の子ファイル。
送信実行結果から state の参照元を決め、normalizeState を通し、setUserState へ渡すことだけを行う。
sendMessage / retry / loading / messages / visibleCount / error / thread反映 / API送信 / confirmed payload生成は持たない。
HOPY唯一の正、state_changed、Compass、DB保存 / DB復元、1..5 の意味判定には触れない。
*/

/*
【今回このファイルで修正したこと】
useChatSend.ts に残っている送信後 state反映責務の受け皿として、この新規子ファイルを作成しました。
hasConfirmedState / hasLegacyState に応じた state の参照元決定、normalizeState、setUserState だけをこの子へ切り出しました。
親が今後、読むだけ・つなぐだけへ寄るための最小責務に限定しました。
*/

/* /components/chat/lib/chatSendApplyUserState.ts */