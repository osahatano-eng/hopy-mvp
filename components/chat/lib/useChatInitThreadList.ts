// /components/chat/lib/useChatInitThreadList.ts
"use client";

import type { Thread } from "./chatTypes";

export function safeIso(v: unknown): string {
  return String(v ?? "").trim();
}

export function toMs(isoLike: string): number {
  const s = String(isoLike ?? "").trim();
  if (!s) return 0;

  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

export function pickTitle(prevTitle: string, nextTitle: string, fallback: string) {
  const n = String(nextTitle ?? "").trim();
  if (n) return n;

  const p = String(prevTitle ?? "").trim();
  if (p) return p;

  return fallback;
}

export function sortThreadsByUpdatedDesc(list: Thread[]): Thread[] {
  const arr = Array.isArray(list) ? list.slice() : [];
  if (arr.length <= 1) return arr;

  const idx = new Map<string, number>();
  for (let i = 0; i < arr.length; i++) {
    const id = String(arr[i]?.id ?? "").trim();
    if (!id) continue;
    if (!idx.has(id)) idx.set(id, i);
  }

  arr.sort((a, b) => {
    const am = toMs(safeIso(a?.updated_at));
    const bm = toMs(safeIso(b?.updated_at));

    if (bm !== am) return bm - am;

    const aid = String(a?.id ?? "").trim();
    const bid = String(b?.id ?? "").trim();
    const ai = idx.get(aid) ?? 0;
    const bi = idx.get(bid) ?? 0;
    return ai - bi;
  });

  return arr;
}

export function mergeThreadsPreferNewer(
  prev: Thread[],
  incoming: Thread[],
  titleFallback: string
): Thread[] {
  const prevList = Array.isArray(prev) ? prev : [];
  const nextList = Array.isArray(incoming) ? incoming : [];

  const prevMap = new Map<string, Thread>();
  for (const t of prevList) {
    const id = String(t?.id ?? "").trim();
    if (!id) continue;
    if (!prevMap.has(id)) prevMap.set(id, t);
  }

  const seen = new Set<string>();
  const out: Thread[] = [];

  for (const t of nextList) {
    const id = String(t?.id ?? "").trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const prevT = prevMap.get(id);
    const incTitle = String(t?.title ?? "").trim();
    const incUpdated = safeIso(t?.updated_at);

    if (!prevT) {
      out.push({
        ...t,
        id,
        title: incTitle || titleFallback,
      });
      continue;
    }

    const prevTitle = String(prevT?.title ?? "").trim();
    const prevUpdated = safeIso(prevT?.updated_at);

    const prevMs = toMs(prevUpdated);
    const incMs = toMs(incUpdated);

    const title =
      incMs > prevMs
        ? pickTitle(prevTitle, incTitle, titleFallback)
        : pickTitle(incTitle, prevTitle, titleFallback);

    let updated_at = prevUpdated;
    if (incUpdated) {
      if (!prevUpdated || incMs >= prevMs) updated_at = incUpdated;
    }

    const merged: Thread = { ...prevT, ...t, id, title };
    if (updated_at) merged.updated_at = updated_at;
    else delete (merged as any).updated_at;

    out.push(merged);
  }

  for (const t of prevList) {
    const id = String(t?.id ?? "").trim();
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      ...t,
      id,
      title: String(t?.title ?? "").trim() || titleFallback,
    });
  }

  return out;
}

export function pickExistingThreadId(
  list: Thread[],
  preferredId: string | null | undefined
): string | null {
  const tid = String(preferredId ?? "").trim();
  if (!tid) return null;

  for (const t of Array.isArray(list) ? list : []) {
    const id = String(t?.id ?? "").trim();
    if (id === tid) return id;
  }

  return null;
}

/*
このファイルの正式役割:
useChatInit 系で使う threads 一覧の整形・マージ責務だけを持つ責務ファイル。
threads の updated_at 基準ソート、incoming と prev の merge、既存 thread id の存在確認を担う。
初期化本体や session 制御は持たない。
*/

/*
【今回このファイルで修正したこと】
1. safeIso を1行で返す形に整理しました。
2. toMs の不要な一時変数分岐を減らしました。
3. mergeThreadsPreferNewer の新規追加分と prev 残し分の組み立てを少し短くし、必要な分岐だけが見える形に整理しました。
4. sort、merge、既存 thread 判定の責務自体、confirmed payload、HOPY唯一の正には触っていません。
*/

/* /components/chat/lib/useChatInitThreadList.ts */

/*
【今回このファイルで修正したこと】
threads 一覧補助責務はそのままに、
不要な回りくどさだけを減らして読みやすく整理しました。
*/