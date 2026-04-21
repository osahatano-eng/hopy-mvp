// /components/chat/view/resolveActiveThreadStateForView.ts
import { useMemo } from "react";
import type { Thread } from "../lib/chatTypes";
import type { HopyState } from "../lib/stateBadge";
import { clampStatePhase } from "../lib/chatThreadState";
import type { ConfirmedThreadState } from "./chatClientViewTypes";

type Params = {
  displayLoggedIn: boolean;
  isViewingPendingEmptyThread: boolean;
  viewActiveThread: Thread | null;
  normalizedResolvedViewUserState: HopyState | null;
};

type Result = {
  resolvedActiveThreadForView: Thread | null;
  resolvedActiveThreadState: ConfirmedThreadState | null;
};

function resolveConfirmedStateFromSource(
  source: Partial<ConfirmedThreadState> | HopyState | null
): ConfirmedThreadState | null {
  if (!source || typeof source !== "object") return null;

  const sourceAny = source as Partial<ConfirmedThreadState>;

  const currentPhase =
    clampStatePhase(sourceAny.current_phase) ??
    clampStatePhase(sourceAny.state_level);

  if (!currentPhase) return null;

  const stateLevel =
    clampStatePhase(sourceAny.state_level) ??
    currentPhase;

  const prevPhase =
    clampStatePhase(sourceAny.prev_phase) ??
    clampStatePhase(sourceAny.prev_state_level) ??
    currentPhase;

  const prevStateLevel =
    clampStatePhase(sourceAny.prev_state_level) ??
    clampStatePhase(sourceAny.prev_phase) ??
    stateLevel;

  const stateChanged =
    typeof sourceAny.state_changed === "boolean"
      ? sourceAny.state_changed
      : false;

  return {
    current_phase: currentPhase,
    state_level: stateLevel,
    prev_phase: prevPhase,
    prev_state_level: prevStateLevel,
    state_changed: stateChanged,
  };
}

export function resolveActiveThreadStateForView({
  displayLoggedIn,
  isViewingPendingEmptyThread,
  viewActiveThread,
  normalizedResolvedViewUserState,
}: Params): Result {
  const resolvedActiveThreadForView = useMemo(() => {
    if (!displayLoggedIn) return null;
    if (isViewingPendingEmptyThread) return null;
    if (!viewActiveThread) return null;
    return viewActiveThread;
  }, [displayLoggedIn, isViewingPendingEmptyThread, viewActiveThread]);

  const resolvedActiveThreadState = useMemo<ConfirmedThreadState | null>(() => {
    if (!displayLoggedIn) return null;
    if (isViewingPendingEmptyThread) return null;

    const stateFromActiveThread = resolveConfirmedStateFromSource(
      resolvedActiveThreadForView as Partial<ConfirmedThreadState> | null
    );

    if (stateFromActiveThread) return stateFromActiveThread;

    return resolveConfirmedStateFromSource(normalizedResolvedViewUserState);
  }, [
    displayLoggedIn,
    isViewingPendingEmptyThread,
    resolvedActiveThreadForView,
    normalizedResolvedViewUserState,
  ]);

  return {
    resolvedActiveThreadForView,
    resolvedActiveThreadState,
  };
}

/*
このファイルの正式役割
表示用の active thread と確定状態を解決する責務だけを持つファイル。
ChatClient 親本体から、表示用の activeThread 解決と activeThreadState 解決を切り出し、
親は受け渡しだけに寄せるための責務分離先である。
*/

/*
【今回このファイルで修正したこと】
1. normalizedResolvedViewUserState を捨てていた void 処理を削除しました。
2. active thread 自身に表示用状態がない場合、本文側の確定済み viewUserState を activeThreadState として使えるようにしました。
3. 新規チャット送信直後に、本文側で確定した状態が左カラムの Current Chat 表示条件へ届く経路を戻しました。
4. 状態値は 1..5 / 5段階だけを通し、0..4 前提にはしていません。
5. HOPY回答○、Compass、送信処理、DB保存、DB復元、他ファイルには触っていません。
*/

/* /components/chat/view/resolveActiveThreadStateForView.ts */