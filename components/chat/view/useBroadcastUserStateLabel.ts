// /components/chat/view/useBroadcastUserStateLabel.ts
import { useEffect, useRef } from "react";
import type { ConfirmedThreadState } from "./chatClientViewTypes";

type Params = {
  displayLoggedIn: boolean;
  resolvedActiveThreadState: ConfirmedThreadState | null;
  userStateErr: string | null;
  uiLang: "ja" | "en";
  stateUnknownShort: string;
};

export function useBroadcastUserStateLabel({
  displayLoggedIn,
  resolvedActiveThreadState,
  userStateErr: _userStateErr,
  uiLang: _uiLang,
  stateUnknownShort: _stateUnknownShort,
}: Params) {
  void _userStateErr;
  void _uiLang;
  void _stateUnknownShort;

  const lastSentStateLabelRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!displayLoggedIn) {
      lastSentStateLabelRef.current = "";
      return;
    }

    const phase = resolvedActiveThreadState?.current_phase ?? null;
    if (!phase) return;

    let nextLabel = "";
    if (phase === 1) {
      nextLabel = "混線";
    } else if (phase === 2) {
      nextLabel = "模索";
    } else if (phase === 3) {
      nextLabel = "整理";
    } else if (phase === 4) {
      nextLabel = "収束";
    } else {
      nextLabel = "決定";
    }

    const normalized = String(nextLabel ?? "").trim();
    if (!normalized) return;
    if (lastSentStateLabelRef.current === normalized) return;

    lastSentStateLabelRef.current = normalized;

    try {
      window.dispatchEvent(new CustomEvent("hopy:user-state", { detail: { label: normalized } }));
    } catch {}
  }, [displayLoggedIn, resolvedActiveThreadState]);
}

/*
このファイルの正式役割
本文側で確定した activeThreadState をもとに、
左カラム表示用の状態ラベルを 1回だけ送出する責務だけを持つファイル。
ChatClient 親本体から、状態ラベル解決と hopy:user-state イベント送出を切り出し、
親は接続だけに寄せるための責務分離先である。
*/

/*
【今回このファイルで修正したこと】
1. userStateErr による「エラー」ラベル補完を削除しました。
2. stateUnknownShort による「不明」ラベル補完を削除しました。
3. resolvedActiveThreadState.current_phase があるときだけ、確定状態ラベルを送出する形に戻しました。
4. 左カラム以外のUI、送信処理、Compass本体、MEMORIES、他責務には触っていません。
*/

/* /components/chat/view/useBroadcastUserStateLabel.ts */