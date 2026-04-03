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

    const source = resolvedActiveThreadForView as any;
    const fallback = normalizedResolvedViewUserState;

    const currentPhase =
      clampStatePhase(source?.current_phase) ??
      clampStatePhase(source?.state_level) ??
      clampStatePhase(fallback?.current_phase) ??
      clampStatePhase(fallback?.state_level);

    if (!currentPhase) return null;

    const prevPhase =
      clampStatePhase(source?.prev_phase) ??
      clampStatePhase(source?.prev_state_level) ??
      clampStatePhase(fallback?.prev_phase) ??
      clampStatePhase(fallback?.prev_state_level) ??
      currentPhase;

    const sourceChanged = source?.state_changed;
    const fallbackChanged = fallback?.state_changed;

    const stateChanged =
      typeof sourceChanged === "boolean"
        ? sourceChanged
        : typeof fallbackChanged === "boolean"
          ? fallbackChanged
          : false;

    return {
      current_phase: currentPhase,
      state_level: currentPhase,
      prev_phase: prevPhase,
      prev_state_level: prevPhase,
      state_changed: stateChanged,
    };
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
1. ConfirmedThreadState の prev_phase / prev_state_level が null を許容しないため、
   prevPhase の最終 fallback を null ではなく currentPhase に変更しました。
2. active thread の解決順、current_phase の解決順、state_changed の扱いには触れていません。
3. 送信処理、Compass本体、MEMORIES、UI文言、他責務には触っていません。
*/