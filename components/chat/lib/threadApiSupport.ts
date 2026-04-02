// /components/chat/lib/threadApiSupport.ts
import type { Dispatch, SetStateAction } from "react";

export const IS_DEV =
  (() => {
    try {
      return process.env.NODE_ENV !== "production";
    } catch {
      return true;
    }
  })() ?? true;

// ✅ 本番は原則ログ抑止（必要時のみ localStorage で有効化）
// - localStorage["hopy_debug"]="1" で有効
export function isDebugLogEnabled(): boolean {
  if (IS_DEV) return true;
  try {
    return typeof window !== "undefined" && localStorage.getItem("hopy_debug") === "1";
  } catch {
    return false;
  }
}

export function logWarn(...args: any[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.warn(...args);
  } catch {}
}

export function logInfo(...args: any[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.info(...args);
  } catch {}
}

export function normMsg(x: any) {
  const m = String(x?.message ?? x ?? "").trim();
  return m || "unknown error";
}

// microtask fallback（古い環境でも落ちない）
export function microtask(fn: () => void) {
  try {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(fn);
      return;
    }
  } catch {}
  Promise.resolve()
    .then(fn)
    .catch(() => {});
}

// ✅ loadMessages 内で使う（このファイル単体で落ちないように）
export function sleep(ms: number) {
  return new Promise<void>((r) => {
    try {
      setTimeout(r, Math.max(0, ms | 0));
    } catch {
      r();
    }
  });
}

export function safeIso(v: any): string {
  const s = String(v ?? "").trim();
  return s;
}

export function nowIso(): string {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

// ✅ client_request_id 用（ブラウザでも落ちない）
export function safeUUID(): string {
  try {
    const g: any = globalThis as any;
    if (g?.crypto && typeof g.crypto.randomUUID === "function") {
      return g.crypto.randomUUID();
    }
  } catch {}
  // fallback（十分一意になればOK）
  try {
    return `cr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  } catch {
    return `cr_${Date.now()}`;
  }
}

export function safeStateLevel(v: any): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  if (n < 1 || n > 5) return undefined;
  return Math.trunc(n);
}

export function safeCurrentPhase(v: any): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  if (n < 1 || n > 5) return undefined;
  return Math.trunc(n);
}

export function safeStabilityScore(v: any): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export function safeText(v: any): string | undefined {
  const s = String(v ?? "").trim();
  return s || undefined;
}

// （このファイルでは現状使っていないが、将来の分割で必要になる可能性があるため
// React型を import しても tree-shaking で消える前提。不要なら後で削除可）
export type ReactStateSetter<T> = Dispatch<SetStateAction<T>>;

/*
このファイルの正式役割
threadApi 系で使う共通補助関数ファイル。
ログ、時刻、ID、数値正規化などの土台だけを担う。

【今回このファイルで修正したこと】
safeCurrentPhase の 0..4 前提をやめ、1..5 に統一した。
safeStateLevel も 1..5 の範囲にそろえた。
*/