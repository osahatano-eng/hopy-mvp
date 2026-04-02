// /components/chat/view/resolveMergedUserStateForView.ts
import { useMemo } from "react";
import { normalizeHopyState, type HopyState } from "../lib/stateBadge";

type Params = {
  viewUserState: HopyState | null;
};

export function resolveMergedUserStateForView({
  viewUserState,
}: Params): {
  normalizedResolvedViewUserState: HopyState | null;
  mergedUserStateForView: HopyState | null;
} {
  const normalizedResolvedViewUserState = useMemo(() => {
    return normalizeHopyState(viewUserState);
  }, [viewUserState]);

  const mergedUserStateForView = useMemo(() => {
    const rawState =
      viewUserState && typeof viewUserState === "object"
        ? (viewUserState as Record<string, unknown>)
        : null;

    const normalizedState =
      normalizedResolvedViewUserState && typeof normalizedResolvedViewUserState === "object"
        ? (normalizedResolvedViewUserState as Record<string, unknown>)
        : null;

    if (rawState && normalizedState) {
      return {
        ...rawState,
        ...normalizedState,
      } as HopyState;
    }

    if (normalizedState) return normalizedResolvedViewUserState;
    if (rawState) return rawState as HopyState;

    return null;
  }, [viewUserState, normalizedResolvedViewUserState]);

  return {
    normalizedResolvedViewUserState,
    mergedUserStateForView,
  };
}

/*
このファイルの正式役割
表示用 userState の正規化とマージ責務だけを持つファイル。
ChatClient 親本体から、viewUserState を表示用に整える責務を切り出し、
親は受け渡しだけに寄せるための責務分離先である。
*/

/*
【今回このファイルで修正したこと】
1. ChatClient.tsx 内にあった normalizedResolvedViewUserState の解決責務を新規ファイルへ分離しました。
2. ChatClient.tsx 内にあった mergedUserStateForView の解決責務を新規ファイルへ分離しました。
3. 状態の唯一の正は再生成せず、既存の normalizeHopyState と既存マージ順だけをそのまま移しています。
4. activeThread 解決、左カラム状態送出、送信処理、Compass本体、MEMORIES、他責務には触っていません。
*/