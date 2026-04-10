// /components/chat/lib/useChatClientBootScroll.ts
"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";

type UseChatClientBootScrollArgs = {
  activeThreadId: string | null;
  viewRenderedLength: number;
  scrollToBottom: (behavior?: ScrollBehavior | "auto" | "smooth") => void;
  atBottomRef: MutableRefObject<boolean>;
  setAtBottom: Dispatch<SetStateAction<boolean>>;
};

export function useChatClientBootScroll({
  activeThreadId,
  viewRenderedLength,
  scrollToBottom,
  atBottomRef,
  setAtBottom,
}: UseChatClientBootScrollArgs) {
  const bootPendingRef = useRef(false);
  const scrollToBottomRef = useRef(scrollToBottom);

  useEffect(() => {
    const tid = String(activeThreadId ?? "").trim();
    if (!tid) return;
    bootPendingRef.current = true;
  }, [activeThreadId]);

  useEffect(() => {
    scrollToBottomRef.current = scrollToBottom;
  }, [scrollToBottom]);

  useLayoutEffect(() => {
    if (!bootPendingRef.current) return;
    if (!String(activeThreadId ?? "").trim()) return;
    if (viewRenderedLength <= 0) return;

    bootPendingRef.current = false;
    atBottomRef.current = true;
    setAtBottom(true);

    const go = () => {
      try {
        scrollToBottomRef.current("auto");
      } catch {}
    };

    try {
      requestAnimationFrame(() => {
        requestAnimationFrame(go);
      });
    } catch {
      go();
    }
  }, [activeThreadId, viewRenderedLength, atBottomRef, setAtBottom]);
}

/*
このファイルの正式役割
ChatClient の中に残っていた boot scroll 責務だけを受け持つ。
activeThreadId 変化を見て初回描画後スクロール待機を立て、
描画完了後に最下部へ寄せる副作用だけを担当する。
HOPY唯一の正や thread switch の意味判定には触れない。
*/

/*
【今回このファイルで修正したこと】
1. ChatClient.tsx に残っていた bootPendingRef をこの新規ファイルへ移しました。
2. scrollToBottomRef の最新参照保持をこの新規ファイルへ移しました。
3. 初回描画後に最下部へ寄せる useLayoutEffect をこの新規ファイルへ移しました。
4. HOPY回答○、Compass、confirmed payload、DB保存・復元の唯一の正には触っていません。
*/

/*
/components/chat/lib/useChatClientBootScroll.ts
*/