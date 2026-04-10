// /components/chat/lib/useChatClientViewportVars.ts
"use client";

import { useEffect, useRef } from "react";

import type React from "react";
import { useComposerHeight, useVisualViewportBottom } from "./hooks";

type ViewportVars = {
  composerH: number;
  vvBottom: number;
  composerOffset: number;
};

type UseChatClientViewportVarsArgs = {
  rootRef: React.RefObject<HTMLElement | null>;
  composerRef: React.RefObject<HTMLElement | null>;
  composerHeightFallback?: number;
};

export function useChatClientViewportVars({
  rootRef,
  composerRef,
  composerHeightFallback = 96,
}: UseChatClientViewportVarsArgs): ViewportVars {
  const composerHRaw = useComposerHeight(
    composerRef as React.RefObject<HTMLElement>,
    composerHeightFallback,
  );
  const vvBottomRaw = useVisualViewportBottom();

  const composerH = Math.max(
    0,
    Math.round(Number.isFinite(composerHRaw) ? composerHRaw : 0),
  );
  const vvBottom = Math.max(
    0,
    Math.round(Number.isFinite(vvBottomRaw) ? vvBottomRaw : 0),
  );
  const composerOffset = composerH + 24 + vvBottom;

  const lastAppliedViewportVarsRef = useRef<ViewportVars | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const prev = lastAppliedViewportVarsRef.current;
    if (
      prev &&
      prev.composerH === composerH &&
      prev.vvBottom === vvBottom &&
      prev.composerOffset === composerOffset
    ) {
      return;
    }

    el.style.setProperty("--composerH", `${composerH}px`);
    el.style.setProperty("--vvBottom", `${vvBottom}px`);
    el.style.setProperty("--composerOffset", `${composerOffset}px`);

    lastAppliedViewportVarsRef.current = {
      composerH,
      vvBottom,
      composerOffset,
    };
  }, [composerH, vvBottom, composerOffset, rootRef]);

  return {
    composerH,
    vvBottom,
    composerOffset,
  };
}

/*
このファイルの正式役割
ChatClient の中に混在していた、
composer 高さ算出・visual viewport 下端算出・CSS変数反映の責務だけを受け持つ。
親ファイルはこの hook を呼び、rootRef / composerRef を渡すだけに寄せる。
*/

/*
【今回このファイルで修正したこと】
1. ChatClient.tsx 内にあった viewport / composer 補正責務を、新規 hook として切り出しました。
2. useComposerHeight、useVisualViewportBottom、composerH / vvBottom / composerOffset 算出、CSS変数反映 effect をこのファイルへ集約しました。
3. HOPY回答○、Compass、confirmed payload、DB保存・復元の唯一の正には触れていません。
*/