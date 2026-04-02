// /components/chat/view/hooks/useVisualViewportVars.ts
"use client";

import { useEffect } from "react";

export function useVisualViewportVars() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const docEl = document.documentElement;
    let raf = 0;
    let disposed = false;

    let baseLayoutH = 0;
    let mql: MediaQueryList | null = null;
    let isMobile = false;

    let lastVvTop = -1;
    let lastVvH = -1;
    let lastKb = -1;

    const resetCachedVars = () => {
      lastVvTop = -1;
      lastVvH = -1;
      lastKb = -1;
    };

    const setVarIfChanged = (name: string, nextPx: number) => {
      const v = Math.max(0, Math.round(nextPx));
      try {
        if (name === "--vvTop") {
          if (v === lastVvTop) return;
          lastVvTop = v;
        } else if (name === "--vvH") {
          if (v === lastVvH) return;
          lastVvH = v;
        } else if (name === "--kb") {
          if (v === lastKb) return;
          lastKb = v;
        }
        docEl.style.setProperty(name, `${v}px`);
      } catch {}
    };

    const update = () => {
      if (disposed) return;

      if (!isMobile) {
        baseLayoutH = 0;

        const h = Number(window.innerHeight || 0);
        setVarIfChanged("--vvTop", 0);
        setVarIfChanged("--vvH", h);
        setVarIfChanged("--kb", 0);
        return;
      }

      const vv: any = (window as any).visualViewport;
      const clientH = Number(document.documentElement?.clientHeight || 0);
      const innerH = Number(window.innerHeight || 0);
      const layoutCandidate = Math.max(innerH, clientH);

      if (!vv) {
        baseLayoutH = Math.max(baseLayoutH, layoutCandidate);

        const vvH = Number(layoutCandidate || innerH || 0);

        setVarIfChanged("--vvTop", 0);
        setVarIfChanged("--vvH", vvH);
        setVarIfChanged("--kb", 0);
        return;
      }

      const top = Number(vv.offsetTop || 0);
      const h = Number(vv.height || layoutCandidate || innerH);
      const kbCandidate = Math.max(0, layoutCandidate - h - top);

      if (kbCandidate <= 18) {
        baseLayoutH = Math.max(baseLayoutH, layoutCandidate);
      } else if (baseLayoutH <= 0) {
        baseLayoutH = layoutCandidate;
      }

      const kb = Math.max(0, baseLayoutH - h - top);

      setVarIfChanged("--vvTop", top);
      setVarIfChanged("--vvH", h);
      setVarIfChanged("--kb", kb);
    };

    const schedule = () => {
      if (disposed) return;
      if (raf) return;

      try {
        raf = window.requestAnimationFrame(() => {
          raf = 0;
          update();
        });
      } catch {
        update();
      }
    };

    const scheduleWithReset = () => {
      resetCachedVars();
      schedule();
    };

    const onMqlChange = () => {
      try {
        isMobile = Boolean(mql?.matches);
      } catch {
        isMobile = false;
      }

      baseLayoutH = 0;
      scheduleWithReset();
    };

    try {
      mql = window.matchMedia("(max-width: 640px)");
      isMobile = Boolean(mql.matches);

      if (typeof mql.addEventListener === "function") mql.addEventListener("change", onMqlChange);
      // @ts-ignore
      else if (typeof mql.addListener === "function") mql.addListener(onMqlChange);
    } catch {
      mql = null;
      isMobile = false;
    }

    update();

    const vv: any = (window as any).visualViewport;
    const onResize = () => schedule();
    const onScroll = () => schedule();
    const onOrientationChange = () => {
      baseLayoutH = 0;
      scheduleWithReset();
    };

    try {
      window.addEventListener("resize", onResize, { passive: true } as any);
      window.addEventListener("orientationchange", onOrientationChange, { passive: true } as any);
    } catch {}

    try {
      if (vv && typeof vv.addEventListener === "function") {
        vv.addEventListener("resize", onResize, { passive: true });
        vv.addEventListener("scroll", onScroll, { passive: true });
      }
    } catch {}

    const onFocusIn = () => schedule();
    const onFocusOut = () => schedule();

    try {
      window.addEventListener("focusin", onFocusIn, { passive: true } as any);
      window.addEventListener("focusout", onFocusOut, { passive: true } as any);
    } catch {}

    const onPageShow = () => {
      baseLayoutH = 0;
      scheduleWithReset();
    };

    const onVisibility = () => {
      try {
        if (document.visibilityState === "visible") {
          baseLayoutH = 0;
          scheduleWithReset();
        }
      } catch {
        baseLayoutH = 0;
        scheduleWithReset();
      }
    };

    try {
      window.addEventListener("pageshow", onPageShow, { passive: true } as any);
    } catch {}

    try {
      document.addEventListener("visibilitychange", onVisibility, { passive: true } as any);
    } catch {}

    return () => {
      disposed = true;

      try {
        if (raf) window.cancelAnimationFrame(raf);
      } catch {}
      raf = 0;

      try {
        window.removeEventListener("resize", onResize as any);
        window.removeEventListener("orientationchange", onOrientationChange as any);
      } catch {}

      try {
        if (vv && typeof vv.removeEventListener === "function") {
          vv.removeEventListener("resize", onResize as any);
          vv.removeEventListener("scroll", onScroll as any);
        }
      } catch {}

      try {
        window.removeEventListener("focusin", onFocusIn as any);
        window.removeEventListener("focusout", onFocusOut as any);
      } catch {}

      try {
        window.removeEventListener("pageshow", onPageShow as any);
      } catch {}

      try {
        document.removeEventListener("visibilitychange", onVisibility as any);
      } catch {}

      try {
        if (mql) {
          if (typeof mql.removeEventListener === "function") mql.removeEventListener("change", onMqlChange);
          // @ts-ignore
          else if (typeof mql.removeListener === "function") mql.removeListener(onMqlChange);
        }
      } catch {}
    };
  }, []);
}