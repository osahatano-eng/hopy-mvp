// /components/chat/lib/useImeStabilizer.ts
"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "./chatTypes";
import { microtask } from "./debugTools";

type Args = {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  setInput: (v: string) => void;
  uiLang?: Lang; // いまは未使用（将来ログ文言などに使える）
};

export function useImeStabilizer({ inputRef, input, setInput }: Args) {
  // 互換・デバッグ用：保持はするが「判断の真実」には使わない
  const imeLockRef = useRef(false);

  // ✅ 送信門番の真実（ref）
  const composingRef = useRef(false);

  // ✅ UIの真実（state）
  const [composing, setComposing] = useState(false);

  const [imeTick, bumpImeTick] = useState(0);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const blurTimerRef: { current: number | null } = { current: null };
    const settleUnlockTimerRef: { current: number | null } = { current: null };

    const dbg = (phase: string, extra?: any) => {
      if (!window.__hopyImeDebugEnabled) return;
      // eslint-disable-next-line no-console
      console.info("[HOPY IME DEBUG]", phase, {
        imeLock: imeLockRef.current,
        composingRef: composingRef.current,
        composingState: composing,
        domValue: el.value,
        stateValue: input,
        ...extra,
      });
    };

    const syncFromDom = (why: string) => {
      const v = String(el.value ?? "");
      setInput(v);
      if (window.__hopyImeDebugEnabled) {
        // eslint-disable-next-line no-console
        console.info("[HOPY IME DEBUG] sync", { why, vLen: v.length });
      }
    };

    const setCompose = (v: boolean, why: string) => {
      composingRef.current = v; // ✅ 最後の門番
      setComposing(v); // ✅ UIの真実
      dbg(`compose:${why}`, { v });
    };

    const setImeLock = (v: boolean, why: string, extra?: any) => {
      if (imeLockRef.current === v) {
        dbg(`imeLock:${why}:noop`, { v, ...extra });
        return;
      }
      imeLockRef.current = v;
      dbg(`imeLock:${why}`, { v, ...extra });
      bumpImeTick((x) => x + 1);
    };

    const isCompositionLikeInputType = (t: any) => {
      const s = String(t ?? "");
      return (
        s.includes("Composition") ||
        s === "insertCompositionText" ||
        s === "deleteCompositionText"
      );
    };

    const isImeProcessKey = (e: KeyboardEvent) => {
      const anyE: any = e as any;
      const key = String(e.key ?? "");
      const code = String(e.code ?? "");
      const keyCode = Number(anyE?.keyCode ?? 0);
      const which = Number(anyE?.which ?? 0);
      if (keyCode === 229 || which === 229) return true;
      if (key === "Process") return true;
      if (code.toLowerCase().includes("process")) return true;
      if (Boolean((anyE as any)?.isComposing)) return true;
      return false;
    };

    const cancelBlurTimer = () => {
      if (blurTimerRef.current != null) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };

    const cancelSettleUnlock = () => {
      if (settleUnlockTimerRef.current != null) {
        window.clearTimeout(settleUnlockTimerRef.current);
        settleUnlockTimerRef.current = null;
      }
    };

    const scheduleBlurClear = (ms: number) => {
      cancelBlurTimer();
      blurTimerRef.current = window.setTimeout(() => {
        blurTimerRef.current = null;
        const active = document.activeElement;
        const stillBlurred = active !== el;
        if (stillBlurred) {
          setImeLock(false, "blur:timeout");
          setCompose(false, "blur:timeout");
        }
        dbg("blur:timeout:done", { stillBlurred });
      }, ms);
    };

    const scheduleSettleUnlock = (why: string) => {
      cancelSettleUnlock();
      settleUnlockTimerRef.current = window.setTimeout(() => {
        settleUnlockTimerRef.current = null;
        const active = document.activeElement;
        const focused = active === el;

        // ✅ composingRef が true の間は絶対に解除しない
        if (focused && !composingRef.current) {
          setImeLock(false, `settleUnlock:${why}`);
          syncFromDom(`settleUnlock:${why}`);
        }
        dbg("settleUnlock:done", { why, focused });
      }, 110);
    };

    const onBeforeInput = (e: Event) => {
      const ie = e as any;
      const isComp = Boolean(ie?.isComposing);
      const inputType = ie?.inputType;

      // ✅ composingRef が true ならフラグが嘘でもIME扱い（門番に合わせる）
      if (composingRef.current || isComp || isCompositionLikeInputType(inputType)) {
        cancelSettleUnlock();
        setImeLock(true, "beforeinput", { inputType, isComp });
        setCompose(true, composingRef.current ? "beforeinput:composingRef" : "beforeinput");
      }
      syncFromDom("beforeinput");
    };

    const onStart = () => {
      cancelBlurTimer();
      cancelSettleUnlock();
      setImeLock(true, "compositionstart");
      setCompose(true, "compositionstart");
    };

    const onUpdate = (e: Event) => {
      const ie = e as any;
      const isComp = Boolean(ie?.isComposing);
      const inputType = ie?.inputType;
      cancelSettleUnlock();
      setImeLock(true, "compositionupdate", { inputType, isComp });
      setCompose(true, "compositionupdate");
      syncFromDom("compositionupdate");
    };

    const onEnd = () => {
      setCompose(false, "compositionend");
      syncFromDom("compositionend:immediate");
      microtask(() => syncFromDom("compositionend:microtask"));
      try {
        requestAnimationFrame(() => syncFromDom("compositionend:raf"));
      } catch {}
      scheduleSettleUnlock("compositionend");
    };

    const onNativeInput = (e: Event) => {
      const ie = e as any;
      const isComp = Boolean(ie?.isComposing);
      const inputType = ie?.inputType;

      if (composingRef.current || isComp || isCompositionLikeInputType(inputType)) {
        cancelSettleUnlock();
        setImeLock(true, "input:ime", { inputType, isComp, force: composingRef.current });
        setCompose(true, composingRef.current ? "input:forceComposingRef" : "input:flag");
        syncFromDom("input:ime");
        return;
      }

      cancelSettleUnlock();
      setImeLock(false, "input:final", { inputType });
      setCompose(false, "input:final");
      syncFromDom("input:final");
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isImeProcessKey(e)) {
        cancelSettleUnlock();
        setImeLock(true, "keydown:ime", {
          key: e.key,
          code: e.code,
          keyCode: (e as any).keyCode,
        });
        setCompose(true, "keydown:ime");
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      dbg("keyup", { key: e.key, code: e.code, keyCode: (e as any).keyCode });
    };

    const onFocus = () => {
      cancelBlurTimer();
      dbg("focus");
    };

    const onBlur = () => {
      dbg("blur:hold");
      setCompose(false, "blur");
      scheduleBlurClear(520);
      bumpImeTick((x) => x + 1);
    };

    el.addEventListener("beforeinput", onBeforeInput as any);
    el.addEventListener("compositionstart", onStart as any);
    el.addEventListener("compositionend", onEnd as any);
    el.addEventListener("compositionupdate", onUpdate as any);
    el.addEventListener("input", onNativeInput as any);
    el.addEventListener("keydown", onKeyDown as any);
    el.addEventListener("keyup", onKeyUp as any);
    el.addEventListener("focus", onFocus as any);
    el.addEventListener("blur", onBlur as any);

    return () => {
      if (blurTimerRef.current != null) window.clearTimeout(blurTimerRef.current);
      if (settleUnlockTimerRef.current != null) window.clearTimeout(settleUnlockTimerRef.current);

      el.removeEventListener("beforeinput", onBeforeInput as any);
      el.removeEventListener("compositionstart", onStart as any);
      el.removeEventListener("compositionend", onEnd as any);
      el.removeEventListener("compositionupdate", onUpdate as any);
      el.removeEventListener("input", onNativeInput as any);
      el.removeEventListener("keydown", onKeyDown as any);
      el.removeEventListener("keyup", onKeyUp as any);
      el.removeEventListener("focus", onFocus as any);
      el.removeEventListener("blur", onBlur as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { composing, composingRef, imeTick };
}