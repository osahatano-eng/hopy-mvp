// /components/chat/lib/useChatInitEventHandlers.ts
"use client";

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Lang, Thread } from "./chatTypes";
import { fetchThreads } from "./threadApi";
import { saveActiveThreadId } from "./threadStore";
import {
  sortThreadsByUpdatedDesc,
  mergeThreadsPreferNewer,
} from "./useChatInitThreadList";

const IS_DEV =
  (() => {
    try {
      return process.env.NODE_ENV !== "production";
    } catch {
      return true;
    }
  })() ?? true;

function isDebugLogEnabled(): boolean {
  if (IS_DEV) return true;
  try {
    return typeof window !== "undefined" && localStorage.getItem("hopy_debug") === "1";
  } catch {
    return false;
  }
}

function logInfo(...args: unknown[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.info(...args);
  } catch {}
}

function logWarn(...args: unknown[]) {
  if (!isDebugLogEnabled()) return;
  try {
    // eslint-disable-next-line no-console
    console.warn(...args);
  } catch {}
}

function microtask(fn: () => void) {
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

function errText(x: unknown) {
  const s = String((x as any)?.message ?? x ?? "").trim();
  return s || "unknown error";
}

function getCustomDetail(ev: Event | undefined): Record<string, unknown> {
  if (!ev) return {};
  try {
    const ce = ev as CustomEvent<unknown>;
    const d = (ce as any)?.detail;
    if (d && typeof d === "object") return d as Record<string, unknown>;
  } catch {}
  return {};
}

type ThreadsRefreshHandlerParams = {
  uiLang: Lang;
  setThreads: Dispatch<SetStateAction<Thread[]>>;
};

export type ThreadsRefreshHandlerArgs = {
  isAlive: () => boolean;
  supabase: SupabaseClient<any>;
  paramsRef: MutableRefObject<ThreadsRefreshHandlerParams>;
  bumpThreadMutation: (reason: string) => void;
};

export function createThreadsRefreshHandler(
  args: ThreadsRefreshHandlerArgs
): EventListener {
  const { isAlive, supabase, paramsRef, bumpThreadMutation } = args;

  return (ev) => {
    if (!isAlive()) return;
    if (typeof window === "undefined") return;

    const p = paramsRef.current;

    try {
      const d = getCustomDetail(ev);

      const reason = String(d?.reason ?? "").trim();
      bumpThreadMutation(reason || "threads-refresh");

      if (reason === "rename-failed") {
        microtask(() => {
          (async () => {
            try {
              const r = await fetchThreads(supabase, p.uiLang);
              if (!isAlive()) return;
              if (!r.ok) return;

              const titleFallback = p.uiLang === "en" ? "New chat" : "新規チャット";
              const incoming = Array.isArray(r.list) ? r.list : [];

              p.setThreads((prev) =>
                sortThreadsByUpdatedDesc(
                  mergeThreadsPreferNewer(
                    Array.isArray(prev) ? prev : [],
                    incoming,
                    titleFallback
                  )
                )
              );
            } catch (e) {
              logWarn(
                "[useChatInitEventHandlers] threads-refresh(rename-failed) refetch error",
                errText(e)
              );
            }
          })();
        });
        return;
      }

      const listRaw = (d as any)?.list ?? (d as any)?.threads ?? (d as any)?.items;
      const hasList = Array.isArray(listRaw);

      const tid = String(
        (d as any)?.id ?? (d as any)?.threadId ?? (d as any)?.thread_id ?? ""
      ).trim();

      let title = String(
        (d as any)?.title ?? (d as any)?.nextTitle ?? (d as any)?.next_title ?? ""
      ).trim();

      const rollbackish =
        reason.includes("rollback") ||
        reason.includes("rename-rollback") ||
        reason.includes("failed") ||
        reason.includes("rename-failed");

      if (!title && rollbackish) {
        title = String(
          (d as any)?.prevTitle ??
            (d as any)?.previousTitle ??
            (d as any)?.prev_title ??
            (d as any)?.previous_title ??
            ""
        ).trim();
      }

      const updated_at_in = String((d as any)?.updated_at ?? "").trim();

      if (!hasList && !tid) return;

      const titleFallback = p.uiLang === "en" ? "New chat" : "新規チャット";

      p.setThreads((prev) => {
        const prevList = Array.isArray(prev) ? prev : [];

        if (hasList) {
          const nextList = (listRaw as any[]).filter(Boolean) as Thread[];
          const merged = mergeThreadsPreferNewer(prevList, nextList, titleFallback);
          return sortThreadsByUpdatedDesc(merged);
        }

        if (!tid) return prevList;
        if (!title && !updated_at_in) return prevList;

        let found = false;
        let changed = false;

        const next = prevList.map((t) => {
          const id = String(t?.id ?? "").trim();
          if (id !== tid) return t;

          found = true;

          const prevTitle = String(t?.title ?? "").trim();
          const prevUpdated = String(t?.updated_at ?? "").trim();

          const nt = title ? title : prevTitle;

          const prevMs = Date.parse(prevUpdated || "");
          const incMs = Date.parse(updated_at_in || "");

          let nu = prevUpdated;
          if (updated_at_in) {
            if (!prevUpdated) nu = updated_at_in;
            else if (Number.isFinite(incMs) && (!Number.isFinite(prevMs) || incMs >= prevMs)) {
              nu = updated_at_in;
            }
          }

          if (prevTitle === nt && prevUpdated === nu) return t;

          changed = true;
          const out: Thread = { ...t };
          if (nt) out.title = nt;
          if (nu) out.updated_at = nu;
          else delete (out as any).updated_at;
          return out;
        });

        if (!found) {
          let ua = updated_at_in;
          if (!ua && !rollbackish) {
            try {
              ua = new Date().toISOString();
            } catch {}
          }

          const out: Thread = { id: tid, title: title || titleFallback };
          if (ua) out.updated_at = ua;

          return sortThreadsByUpdatedDesc([out, ...prevList]);
        }

        if (!changed) return prevList;
        return sortThreadsByUpdatedDesc(next);
      });
    } catch (e) {
      logWarn("[useChatInitEventHandlers] threads-refresh handler error", errText(e));
    }
  };
}

export function createSelectThreadHandler(args: {
  isAlive: () => boolean;
  bumpThreadMutation: (reason: string) => void;
}): EventListener {
  const { isAlive, bumpThreadMutation } = args;

  return (ev) => {
    if (!isAlive()) return;
    if (typeof window === "undefined") return;

    try {
      const d = getCustomDetail(ev);
      const tid = String(
        (d as any)?.threadId ?? (d as any)?.id ?? (d as any)?.thread_id ?? ""
      ).trim();
      const reason = String((d as any)?.reason ?? "select-thread").trim();

      bumpThreadMutation(reason || "select-thread");

      if (tid) {
        try {
          saveActiveThreadId(tid);
        } catch {}
        logInfo("[useChatInitEventHandlers] select-thread observed", { tid, reason });
      }
    } catch {
      bumpThreadMutation("select-thread");
    }
  };
}

/*
このファイルの正式役割:
useChatInit 系で使うイベント受け口だけを持つ責務ファイル。
threads-refresh / select-thread のイベントを受け、
必要な更新だけを行う。初期化本体は持たない。
*/

/*
【今回このファイルで修正したこと】
1. もう本線で使っていない createThreadObservedHandler を削除しました。
2. 重複していた正式役割コメントと修正コメントを1組に整理しました。
3. threads 一覧整形責務は useChatInitThreadList.ts から import する形のまま維持し、このファイルには event handler 本体だけを残しました。
4. init 本体、session retry、本体の thread 作成制御、confirmed payload、HOPY唯一の正には触っていません。
*/

/* /components/chat/lib/useChatInitEventHandlers.ts */

/*
【今回このファイルで修正したこと】
未使用の thread observed handler と重複コメントを削除し、
このファイルの責務を threads-refresh / select-thread の受け口だけに戻しました。
*/