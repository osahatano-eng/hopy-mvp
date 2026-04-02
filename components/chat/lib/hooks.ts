/* /components/chat/lib/hooks.ts */
"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** textarea 自動伸縮 */
export function useAutoGrowTextarea(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  maxHeight = 160
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.overflowY = "hidden";
    el.style.resize = "none";
    el.style.height = "auto";

    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
  }, [ref, value, maxHeight]);
}

/** composer の高さ監視（ResizeObserver） */
export function useComposerHeight(composerRef: React.RefObject<HTMLElement>, min = 96) {
  const [composerH, setComposerH] = useState(120);

  useLayoutEffect(() => {
    const el = composerRef.current;
    if (!el) return;

    const update = () => {
      const h = Math.max(min, Math.ceil(el.getBoundingClientRect().height));
      setComposerH(h);
    };

    update();

    // ResizeObserver が無い環境は極小サポート（基本はある）
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    } catch {
      ro = null;
    }

    window.addEventListener("resize", update, { passive: true });
    return () => {
      try {
        ro?.disconnect();
      } catch {}
      window.removeEventListener("resize", update);
    };
  }, [composerRef, min]);

  return composerH;
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * ✅ 横揺れ（横スクロール）を強制的に封じる（安定性フェーズ用）
 *
 * 根治はCSS（max-width/overflow-wrap 等）だが、
 * iOS Safari で “一瞬だけ幅がはみ出す” 事故があるため、
 * ここで html/body に safety guard を入れる。
 *
 * - cleanup で元に戻す（デグレード防止）
 */
export function usePreventHorizontalScroll(enabled: boolean = true) {
  useLayoutEffect(() => {
    if (!enabled) return;
    if (typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;

    if (!html || !body) return;

    // 現状値を保存
    const prev = {
      htmlOverflowX: html.style.overflowX,
      bodyOverflowX: body.style.overflowX,
      htmlOverscrollX: (html.style as any).overscrollBehaviorX,
      bodyOverscrollX: (body.style as any).overscrollBehaviorX,
      htmlTouchAction: (html.style as any).touchAction,
      bodyTouchAction: (body.style as any).touchAction,
    };

    // 横スクロール封印
    html.style.overflowX = "hidden";
    body.style.overflowX = "hidden";

    // iOS/モダン系での横バウンス抑制（効くブラウザだけ）
    try {
      (html.style as any).overscrollBehaviorX = "none";
      (body.style as any).overscrollBehaviorX = "none";
    } catch {}

    // 横パン（左右スワイプ）を抑え、縦スクロールは許可
    // Safari は効かないこともあるが害は少ない
    try {
      (html.style as any).touchAction = "pan-y";
      (body.style as any).touchAction = "pan-y";
    } catch {}

    return () => {
      // 元に戻す
      html.style.overflowX = prev.htmlOverflowX;
      body.style.overflowX = prev.bodyOverflowX;

      try {
        (html.style as any).overscrollBehaviorX = prev.htmlOverscrollX;
        (body.style as any).overscrollBehaviorX = prev.bodyOverscrollX;
      } catch {}

      try {
        (html.style as any).touchAction = prev.htmlTouchAction;
        (body.style as any).touchAction = prev.bodyTouchAction;
      } catch {}
    };
  }, [enabled]);
}

/**
 * モバイルキーボード対応（visualViewport bottom inset 推定）
 *
 * 安定化方針:
 * - iOS Safari は vv が一瞬 0 に落ちたり、offsetTop が揺れることがある
 * - “キーボードが出ているっぽいのに inset が 0” を強く補正する
 */
export function useVisualViewportBottom() {
  const [vvBottom, setVvBottom] = useState(0);

  const lastRef = useRef(0);
  const lastNonZeroRef = useRef(0);
  const lastNonZeroAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const vv = window.visualViewport;
    if (!vv) return;

    let raf = 0;
    let scheduled = false;

    // 微小揺れ吸収のための丸め単位（px）
    const ROUND_STEP = 2;

    // このpx以下の変化は無視（jitter抑制）
    const JITTER_PX = 2;

    // 0へ戻る瞬間が発生しがちなので“最後の非0を保持”
    const HOLD_ZERO_MS = 320;

    // “キーボードが出てるはず” 推定（layoutH - vvH がこれ以上）
    const KEYBOARD_GUESS_PX = 80;

    // キーボード推定時に inset=0 が来たら、より長く保持
    const HOLD_WHEN_KEYBOARD_MS = 900;

    // 異常値のガード
    const MAX_INSET = 900;

    const nowMs = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = typeof performance !== "undefined" ? performance : null;
      if (p && typeof p.now === "function") return p.now();
      return Date.now();
    };

    const roundTo = (n: number, step: number) => {
      if (step <= 1) return Math.round(n);
      return Math.round(n / step) * step;
    };

    const compute = () => {
      scheduled = false;

      const layoutH = window.innerHeight || 0;
      const vvH = vv.height || 0;
      const top = vv.offsetTop || 0;

      const raw = Math.max(0, layoutH - vvH - top);
      let next = roundTo(raw, ROUND_STEP);
      next = clampInt(next, 0, MAX_INSET);

      const t = nowMs();

      const keyboardLikely = layoutH > 0 && vvH > 0 && layoutH - vvH >= KEYBOARD_GUESS_PX;

      if (next > 0) {
        lastNonZeroRef.current = next;
        lastNonZeroAtRef.current = t;
      } else {
        const age = t - lastNonZeroAtRef.current;

        const holdMs = keyboardLikely ? HOLD_WHEN_KEYBOARD_MS : HOLD_ZERO_MS;
        if (lastNonZeroRef.current > 0 && age >= 0 && age < holdMs) {
          next = lastNonZeroRef.current;
        }
      }

      const prev = lastRef.current;
      if (Math.abs(next - prev) <= JITTER_PX) return;

      lastRef.current = next;
      setVvBottom(next);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };

    schedule();

    vv.addEventListener("resize", schedule, { passive: true } as any);
    vv.addEventListener("scroll", schedule, { passive: true } as any);

    window.addEventListener("orientationchange", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("focus", schedule, { passive: true });
    window.addEventListener("blur", schedule, { passive: true });
    document.addEventListener("visibilitychange", schedule, { passive: true } as any);

    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule as any);
      vv.removeEventListener("scroll", schedule as any);
      window.removeEventListener("orientationchange", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("focus", schedule as any);
      window.removeEventListener("blur", schedule as any);
      document.removeEventListener("visibilitychange", schedule as any);
    };
  }, []);

  return vvBottom;
}

/** スクロールが最下部かどうかを内部スクロール要素で管理 */
export function useScrollerAtBottom(scrollerRef: React.RefObject<HTMLDivElement>) {
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);

  const isNearBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    const threshold = 28;
    const remain = el.scrollHeight - el.scrollTop - el.clientHeight;
    return remain <= threshold;
  }, [scrollerRef]);

  const syncAtBottom = useCallback(() => {
    const near = isNearBottom();
    atBottomRef.current = near;
    setAtBottom(near);
  }, [isNearBottom]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const el = scrollerRef.current;
      if (!el) return;

      const top = el.scrollHeight;

      if (behavior === "smooth") {
        try {
          el.scrollTo({ top, behavior: "smooth" });
        } catch {
          el.scrollTop = top;
        }
      } else {
        el.scrollTop = top;
      }
    },
    [scrollerRef]
  );

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => syncAtBottom();
    el.addEventListener("scroll", onScroll, { passive: true });

    queueMicrotask(() => syncAtBottom());

    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollerRef, syncAtBottom]);

  return { atBottom, setAtBottom, atBottomRef, syncAtBottom, scrollToBottom };
}