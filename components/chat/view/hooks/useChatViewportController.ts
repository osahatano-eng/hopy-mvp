// /components/chat/view/hooks/useChatViewportController.ts
"use client";

import React from "react";

function isMobileNow() {
  if (typeof window === "undefined") return false;
  return window.matchMedia && window.matchMedia("(max-width: 640px)").matches;
}

export function useChatViewportController(args: {
  workspaceMode: boolean;
  activeThreadId: string | null;
  renderedLength: number;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  scrollerRef: React.RefObject<HTMLDivElement | null>;
  atBottomRef: React.MutableRefObject<boolean>;
  setAtBottom: (v: boolean) => void;
  scrollToBottom: (behavior?: ScrollBehavior | "auto" | "smooth") => void;
  dismissWorkspaceHero: () => void;
}) {
  const {
    workspaceMode,
    activeThreadId,
    renderedLength,
    inputRef,
    scrollerRef,
    atBottomRef,
    setAtBottom,
    dismissWorkspaceHero,
  } = args;

  const [isMobile, setIsMobile] = React.useState(() => isMobileNow());
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const scrollScrollerToBottom = React.useCallback(
    (behavior: ScrollBehavior | "auto" | "smooth" = "auto") => {
      atBottomRef.current = true;
      setAtBottom(true);

      try {
        const sc = scrollerRef.current;
        if (!sc) return;

        if (behavior === "smooth") {
          sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" });
        } else {
          sc.scrollTop = sc.scrollHeight;
        }
      } catch {}
    },
    [scrollerRef, atBottomRef, setAtBottom]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(Boolean(mql.matches));
    apply();

    const onChange = () => apply();

    try {
      if (typeof mql.addEventListener === "function") {
        mql.addEventListener("change", onChange);
        return () => mql.removeEventListener("change", onChange);
      }
    } catch {}

    try {
      // @ts-ignore
      if (typeof mql.addListener === "function") {
        // @ts-ignore
        mql.addListener(onChange);
        // @ts-ignore
        return () => mql.removeListener(onChange);
      }
    } catch {}

    return;
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => {
      try {
        const el = inputRef.current;
        if (!el) {
          setIsInputFocused(false);
          return;
        }
        const focused = typeof document !== "undefined" && document.activeElement === el;
        setIsInputFocused(Boolean(focused));
      } catch {}
    };

    sync();

    const onFocusIn = () => sync();
    const onFocusOut = () => sync();

    try {
      window.addEventListener("focusin", onFocusIn, true);
      window.addEventListener("focusout", onFocusOut, true);
    } catch {}

    return () => {
      try {
        window.removeEventListener("focusin", onFocusIn, true);
        window.removeEventListener("focusout", onFocusOut, true);
      } catch {}
    };
  }, [inputRef]);

  const focusIntentScrollTopRef = React.useRef<number | null>(null);
  const focusGuardArmedRef = React.useRef(false);

  const armFocusGuard = React.useCallback(() => {
    dismissWorkspaceHero();

    focusIntentScrollTopRef.current = null;
    focusGuardArmedRef.current = false;
  }, [dismissWorkspaceHero]);

  const runFocusGuard = React.useCallback(() => {
    dismissWorkspaceHero();

    focusGuardArmedRef.current = false;
    focusIntentScrollTopRef.current = null;
  }, [dismissWorkspaceHero]);

  React.useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;

    let obs: IntersectionObserver | null = null;

    try {
      const root = scrollerRef.current ?? null;
      obs = new IntersectionObserver(
        (entries) => {
          const e = entries && entries[0];
          if (!e) return;

          const isAt = Boolean(e.isIntersecting);
          atBottomRef.current = isAt;
          setAtBottom(isAt);
        },
        {
          root,
          threshold: 0.01,
          rootMargin: "0px 0px 140px 0px",
        }
      );

      obs.observe(el);
    } catch {}

    return () => {
      try {
        obs?.disconnect();
      } catch {}
    };
  }, [scrollerRef, setAtBottom, atBottomRef]);

  const stickToBottomNow = React.useCallback(() => {
    try {
      requestAnimationFrame(() => {
        scrollScrollerToBottom("auto");
      });
    } catch {}
  }, [scrollScrollerToBottom]);

  const bootKeyRef = React.useRef<string>("");
  React.useEffect(() => {
    if (!workspaceMode) return;
    const tid = String(activeThreadId ?? "").trim();
    if (!tid) return;
    if (renderedLength === 0) return;

    const key = tid;
    if (bootKeyRef.current === key) return;
    bootKeyRef.current = key;

    try {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollScrollerToBottom("auto");
        });
      });
    } catch {}
  }, [workspaceMode, activeThreadId, renderedLength, scrollScrollerToBottom]);

  const scrollComposerAreaToBottom = React.useCallback(() => {
    try {
      requestAnimationFrame(() => {
        scrollScrollerToBottom("auto");
      });
    } catch {}
  }, [scrollScrollerToBottom]);

  const jumpToBottom = React.useCallback(
    (behavior: ScrollBehavior | "auto" | "smooth" = "auto") => {
      scrollScrollerToBottom(behavior);
    },
    [scrollScrollerToBottom]
  );

  const onJumpToBottom = React.useCallback(() => {
    jumpToBottom("auto");
  }, [jumpToBottom]);

  return {
    isMobile,
    isInputFocused,
    bottomRef,
    armFocusGuard,
    runFocusGuard,
    stickToBottomNow,
    scrollComposerAreaToBottom,
    jumpToBottom,
    onJumpToBottom,
  };
}

/*
このファイルの正式役割
SP/PC のチャット表示領域に対して、入力欄 focus 補助・最下部追従・atBottom 判定・スレッド初期表示時の下端合わせを管理する hooks。
本文表示や状態の唯一の正は持たず、viewport/scroll の補助だけを担当する。
*/

/*
【今回このファイルで修正したこと】
visualViewport の resize / scroll 監視で入力欄 focus 中に stickToBottomNow を走らせる処理を削除しました。
SPブラウザでの過剰な viewport 追従を止め、入力欄タップ時の跳ねや位置ずれの原因になりやすい補正の重なりを減らしました。
scrollComposerAreaToBottom で requestAnimationFrame と setTimeout による二重の下端補助をやめ、1回だけに減らしました。
runFocusGuard で requestAnimationFrame と setTimeout による二重の復元補助をやめ、1回だけに減らしました。
stickToBottomNow で requestAnimationFrame の二重補助をやめ、1回だけに減らしました。
今回さらに、Safari のキーボード開閉時に競合しやすい独自の focusGuard 復元自体を止め、armFocusGuard / runFocusGuard を no-op 化しました。
*/