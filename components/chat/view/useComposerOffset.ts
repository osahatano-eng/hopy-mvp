// /components/chat/view/useComposerOffset.ts
"use client";

import { useEffect } from "react";

/**
 * Measure composer height and reflect it to CSS variable --composerOffset
 * so streamInner padding-bottom always matches the real composer height.
 *
 * - Works on SP/PC
 * - Avoids hard-coded offsets and "message behind composer" bugs
 */
export function useComposerOffset(params: {
  rootRef: React.RefObject<HTMLElement | null>;
  composerRef: React.RefObject<HTMLElement | null>;
  extraPx?: number; // small safety gap
}) {
  const { rootRef, composerRef, extraPx = 18 } = params;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let raf = 0;
    let disposed = false;

    let ro: ResizeObserver | null = null;
    let cleanupFallback: (() => void) | null = null;
    let lastApplied = -1;

    const apply = () => {
      if (disposed) return;

      const rootEl = rootRef.current;
      const composerEl = composerRef.current;
      if (!rootEl || !composerEl) return;

      try {
        const rect = composerEl.getBoundingClientRect();
        const h = Math.max(0, Math.round(rect.height + extraPx));

        if (h === lastApplied) return;
        lastApplied = h;

        rootEl.style.setProperty("--composerOffset", `${h}px`);
      } catch {}
    };

    const schedule = () => {
      if (disposed) return;

      try {
        if (raf) return;
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          apply();
        });
      } catch {
        apply();
      }
    };

    schedule();

    const composerEl = composerRef.current;
    if (composerEl) {
      try {
        ro = new ResizeObserver(() => schedule());
        ro.observe(composerEl);
      } catch {
        const onResize = () => schedule();

        try {
          window.addEventListener("resize", onResize, { passive: true } as any);
        } catch {}
        try {
          window.addEventListener("orientationchange", onResize, { passive: true } as any);
        } catch {}

        const vv: any = (window as any).visualViewport;
        try {
          if (vv && typeof vv.addEventListener === "function") {
            vv.addEventListener("resize", onResize, { passive: true });
            vv.addEventListener("scroll", onResize, { passive: true });
          }
        } catch {}

        cleanupFallback = () => {
          try {
            window.removeEventListener("resize", onResize as any);
          } catch {}
          try {
            window.removeEventListener("orientationchange", onResize as any);
          } catch {}
          try {
            if (vv && typeof vv.removeEventListener === "function") {
              vv.removeEventListener("resize", onResize as any);
              vv.removeEventListener("scroll", onResize as any);
            }
          } catch {}
        };
      }
    }

    return () => {
      disposed = true;

      try {
        if (raf) cancelAnimationFrame(raf);
      } catch {}
      raf = 0;

      try {
        ro?.disconnect();
      } catch {}
      try {
        cleanupFallback?.();
      } catch {}
    };
  }, [rootRef, composerRef, extraPx]);
}