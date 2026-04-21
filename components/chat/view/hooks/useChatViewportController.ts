// /components/chat/view/hooks/useChatViewportController.ts
"use client";

import React from "react";

const COMPOSER_SCROLL_OFFSET_PX = 0;

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
  } = args;

  const [isMobile, setIsMobile] = React.useState(() => isMobileNow());
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  const updateAtBottom = React.useCallback(
    (next: boolean) => {
      if (atBottomRef.current === next) return;
      atBottomRef.current = next;
      setAtBottom(next);
    },
    [atBottomRef, setAtBottom],
  );

  const syncAtBottomFromScroller = React.useCallback(() => {
    try {
      const sc = scrollerRef.current;
      if (!sc) return;

      const distanceFromBottom =
        sc.scrollHeight - sc.scrollTop - sc.clientHeight;

      updateAtBottom(distanceFromBottom <= 140);
    } catch {}
  }, [scrollerRef, updateAtBottom]);

  const scrollScrollerToBottom = React.useCallback(
    (
      behavior: ScrollBehavior | "auto" | "smooth" = "auto",
      offsetFromBottomPx = 0,
    ) => {
      atBottomRef.current = true;
      setAtBottom(true);

      try {
        const sc = scrollerRef.current;
        if (!sc) return;

        const offset = Math.max(0, Number(offsetFromBottomPx) || 0);
        const nextTop = Math.max(
          0,
          sc.scrollHeight - sc.clientHeight - offset,
        );

        if (behavior === "smooth") {
          sc.scrollTo({ top: nextTop, behavior: "smooth" });
        } else {
          sc.scrollTop = nextTop;
        }
      } catch {}
    },
    [scrollerRef, atBottomRef, setAtBottom],
  );

  React.useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;

    const style = sc.style as CSSStyleDeclaration & {
      overflowAnchor?: string;
    };
    const previousOverflowAnchor = style.overflowAnchor ?? "";

    try {
      style.overflowAnchor = "none";
    } catch {}

    return () => {
      try {
        style.overflowAnchor = previousOverflowAnchor;
      } catch {}
    };
  }, [scrollerRef, workspaceMode, activeThreadId]);

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
        const focused =
          typeof document !== "undefined" && document.activeElement === el;
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

  const armFocusGuard = React.useCallback(() => {}, []);

  const runFocusGuard = React.useCallback(() => {}, []);

  React.useEffect(() => {
    const sc = scrollerRef.current;
    if (!sc) return;

    let frame = 0;

    const scheduleSync = () => {
      try {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          syncAtBottomFromScroller();
        });
      } catch {
        syncAtBottomFromScroller();
      }
    };

    scheduleSync();

    try {
      sc.addEventListener("scroll", scheduleSync, { passive: true });
      window.addEventListener("resize", scheduleSync, { passive: true });
    } catch {}

    return () => {
      try {
        window.cancelAnimationFrame(frame);
      } catch {}

      try {
        sc.removeEventListener("scroll", scheduleSync);
        window.removeEventListener("resize", scheduleSync);
      } catch {}
    };
  }, [
    scrollerRef,
    syncAtBottomFromScroller,
    workspaceMode,
    activeThreadId,
    renderedLength,
  ]);

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

          updateAtBottom(Boolean(e.isIntersecting));
        },
        {
          root,
          threshold: 0.01,
          rootMargin: "0px 0px 140px 0px",
        },
      );

      obs.observe(el);
    } catch {}

    return () => {
      try {
        obs?.disconnect();
      } catch {}
    };
  }, [
    scrollerRef,
    updateAtBottom,
    workspaceMode,
    activeThreadId,
    renderedLength,
  ]);

  const stickToBottomNow = React.useCallback(() => {
    try {
      requestAnimationFrame(() => {
        scrollScrollerToBottom("auto", COMPOSER_SCROLL_OFFSET_PX);
      });
    } catch {}
  }, [scrollScrollerToBottom]);

  const bootKeyRef = React.useRef<string>("");

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        bootKeyRef.current = "";
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

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

  const renderedGrowthRef = React.useRef<{
    threadId: string;
    renderedLength: number;
  }>({
    threadId: "",
    renderedLength: 0,
  });

  const skipNextGrowthScrollRef = React.useRef<{
    threadId: string;
    shouldSkip: boolean;
  }>({
    threadId: "",
    shouldSkip: false,
  });

  React.useEffect(() => {
    if (!workspaceMode) return;

    const tid = String(activeThreadId ?? "").trim();
    if (!tid) return;
    if (renderedLength === 0) return;

    const prev = renderedGrowthRef.current;
    const sameThread = prev.threadId === tid;
    const didGrow = sameThread && renderedLength > prev.renderedLength;

    if (!sameThread) {
      skipNextGrowthScrollRef.current = {
        threadId: tid,
        shouldSkip: false,
      };
    }

    renderedGrowthRef.current = {
      threadId: tid,
      renderedLength,
    };

    if (!didGrow) return;

    const shouldSkip =
      skipNextGrowthScrollRef.current.threadId === tid &&
      skipNextGrowthScrollRef.current.shouldSkip;

    if (shouldSkip) {
      skipNextGrowthScrollRef.current = {
        threadId: tid,
        shouldSkip: false,
      };
      return;
    }

    if (!atBottomRef.current) return;

    skipNextGrowthScrollRef.current = {
      threadId: tid,
      shouldSkip: true,
    };

    try {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollScrollerToBottom("auto", COMPOSER_SCROLL_OFFSET_PX);
        });
      });
    } catch {}
  }, [
    workspaceMode,
    activeThreadId,
    renderedLength,
    atBottomRef,
    scrollScrollerToBottom,
  ]);

  const scrollComposerAreaToBottom = React.useCallback(() => {
    try {
      requestAnimationFrame(() => {
        scrollScrollerToBottom("auto", COMPOSER_SCROLL_OFFSET_PX);
      });
    } catch {}
  }, [scrollScrollerToBottom]);

  const jumpToBottom = React.useCallback(
    (behavior: ScrollBehavior | "auto" | "smooth" = "auto") => {
      scrollScrollerToBottom(behavior);
    },
    [scrollScrollerToBottom],
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
1. YOU送信時の停止位置を、現在のHOPY回答後の最高位置に近づけるため、COMPOSER_SCROLL_OFFSET_PX を 96 から 0 にしました。
2. HOPY回答の高さ変化でブラウザのスクロールアンカーが働いて画面がピクっと動く可能性を抑えるため、scroller に overflow-anchor: none を適用しました。
3. HOPY回答追加時のスクロール補正スキップ処理は維持しました。
4. 初回アクセス時・スレッド初期表示時・jumpボタン押下時の最下部移動は維持しました。
5. ChatComposer.tsx は確認のみで、今回の直接修正対象にはしていません。
6. ChatStream.tsx の下余白、本文採用、送信処理、jumpボタン判定、confirmed payload、state_changed、HOPY回答○、Compass、DB保存/復元、1..5 の唯一の正には触っていません。
*/

/* /components/chat/view/hooks/useChatViewportController.ts */