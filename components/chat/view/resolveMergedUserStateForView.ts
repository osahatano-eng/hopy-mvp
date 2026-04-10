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
    if (normalizedResolvedViewUserState) return normalizedResolvedViewUserState;
    if (viewUserState) return viewUserState;
    return null;
  }, [viewUserState, normalizedResolvedViewUserState]);

  return {
    normalizedResolvedViewUserState,
    mergedUserStateForView,
  };
}

/*
このファイルの正式役割
表示用 userState の正規化と受け渡し責務だけを持つファイル。
ChatClient 親本体から、viewUserState を表示用に整える責務を切り出し、
親は受け渡しだけに寄せるための責務分離先である。
*/

/*
【今回このファイルで修正したこと】
1. rawState と normalizedState のマージ処理を削除しました。
2. mergedUserStateForView は、normalizeHopyState(viewUserState) の結果を優先し、なければ viewUserState をそのまま返す形に戻しました。
3. 表示用 userState をこの層で再構成しないようにし、不要な fallback 補完を減らしました。
4. activeThread 解決、左カラム状態送出、送信処理、Compass本体、MEMORIES、他責務には触っていません。
*/

/* /components/chat/view/resolveMergedUserStateForView.ts */