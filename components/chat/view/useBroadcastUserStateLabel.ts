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
  userStateErr,
  uiLang,
  stateUnknownShort,
}: Params) {
  const lastSentStateLabelRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!displayLoggedIn) {
      lastSentStateLabelRef.current = "";
      return;
    }

    const phase = resolvedActiveThreadState?.current_phase ?? null;

    let nextLabel = "";
    if (userStateErr) {
      nextLabel = uiLang === "en" ? "Error" : "エラー";
    } else if (!phase) {
      nextLabel = stateUnknownShort;
    } else if (phase === 1) {
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
  }, [displayLoggedIn, resolvedActiveThreadState, userStateErr, uiLang, stateUnknownShort]);
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
1. ChatClient.tsx 内にあった lastSentStateLabelRef を新規ファイルへ分離しました。
2. ChatClient.tsx 内にあった hopy:user-state 送出 useEffect を新規ファイルへ分離しました。
3. 状態の唯一の正は再判定せず、resolvedActiveThreadState と userStateErr をそのまま使って表示ラベルだけ解決しています。
4. 左カラム以外のUI、送信処理、Compass本体、MEMORIES、他責務には触っていません。
*/