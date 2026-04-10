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
  normalizedResolvedViewUserState: _normalizedResolvedViewUserState,
}: Params): Result {
  void _normalizedResolvedViewUserState;

  const resolvedActiveThreadForView = useMemo(() => {
    if (!displayLoggedIn) return null;
    if (isViewingPendingEmptyThread) return null;
    if (!viewActiveThread) return null;
    return viewActiveThread;
  }, [displayLoggedIn, isViewingPendingEmptyThread, viewActiveThread]);

  const resolvedActiveThreadState = useMemo<ConfirmedThreadState | null>(() => {
    if (!displayLoggedIn) return null;
    if (isViewingPendingEmptyThread) return null;
    if (!resolvedActiveThreadForView) return null;

    const source = resolvedActiveThreadForView as Partial<ConfirmedThreadState> | null;
    if (!source) return null;

    const currentPhase = clampStatePhase(source.current_phase);
    const stateLevel = clampStatePhase(source.state_level);
    const prevPhase = clampStatePhase(source.prev_phase);
    const prevStateLevel = clampStatePhase(source.prev_state_level);
    const stateChanged = source.state_changed;

    if (
      !currentPhase ||
      !stateLevel ||
      !prevPhase ||
      !prevStateLevel ||
      typeof stateChanged !== "boolean"
    ) {
      return null;
    }

    return {
      current_phase: currentPhase,
      state_level: stateLevel,
      prev_phase: prevPhase,
      prev_state_level: prevStateLevel,
      state_changed: stateChanged,
    };
  }, [displayLoggedIn, isViewingPendingEmptyThread, resolvedActiveThreadForView]);

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
1. normalizedResolvedViewUserState を使った fallback 補完を削除しました。
2. resolvedActiveThreadState は、active thread 自身が持つ確定値だけを採用する形に戻しました。
3. current_phase / state_level / prev_phase / prev_state_level / state_changed のどれかが欠けている場合は、補わず null を返す形にしました。
4. HOPY回答○、Compass、送信処理、DB保存、DB復元、他ファイルには触っていません。
*/

/* /components/chat/view/resolveActiveThreadStateForView.ts */