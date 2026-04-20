// /components/chat/lib/useChatInitUtils.ts
"use client";

export const IS_DEV =
  (() => {
    try {
      return process.env.NODE_ENV !== "production";
    } catch {
      return true;
    }
  })() ?? true;

export function isDebugLogEnabled(): boolean {
  if (IS_DEV) return true;
  try {
    return typeof window !== "undefined" && localStorage.getItem("hopy_debug") === "1";
  } catch {
    return false;
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function logInfo(...args: unknown[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.info(...args);
  } catch {}
}

export function logWarn(...args: unknown[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.warn(...args);
  } catch {}
}

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

export function errText(x: unknown) {
  const s = String((x as any)?.message ?? x ?? "").trim();
  return s || "unknown error";
}

export function getCustomDetail(ev: Event | undefined): Record<string, unknown> {
  if (!ev) return {};

  try {
    const ce = ev as CustomEvent<unknown>;
    const d = (ce as any)?.detail;

    if (d && typeof d === "object") {
      return d as Record<string, unknown>;
    }
  } catch {}

  return {};
}

/*
このファイルの正式役割:
useChatInitParts.ts から切り出した、チャット初期化まわりの補助ユーティリティを担う。
debug 判定、log、sleep、microtask、error text 化、custom event detail 取得だけを担当する。
session / profile / plan / threads / activeThread / messages / HOPY状態 / Compass / confirmed payload の正は作らない。
*/

/*
【今回このファイルで修正したこと】
1. useChatInitParts.ts に混在していた初期化補助ユーティリティ責務を、新規ファイルへ分離しました。
2. このファイルは補助関数だけを持ち、init本体・profile取得・threads取得・新規thread作成制御には触れていません。
3. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元仕様には触れていません。
*/

/* /components/chat/lib/useChatInitUtils.ts */