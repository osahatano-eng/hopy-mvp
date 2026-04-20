// /components/chat/lib/useChatInitActiveThread.ts
"use client";

import type { MutableRefObject } from "react";

import type { Thread } from "./chatTypes";
import { saveActiveThreadId, clearActiveThreadId, loadActiveThreadId } from "./threadStore";
import {
  sortThreadsByUpdatedDesc,
  pickExistingThreadId,
} from "./useChatInitThreadList";

export type ResolveActiveThreadTargetResult = {
  sortedList: Thread[];
  preferredActiveThreadId: string | null;
  currentTargetThreadId: string | null;
};

export function readPreferredActiveThreadId(args: {
  activeThreadIdShadowRef: MutableRefObject<string | null>;
}): string | null {
  const { activeThreadIdShadowRef } = args;

  try {
    const storedId = String(loadActiveThreadId() ?? "").trim();
    if (storedId) return storedId;
  } catch {}

  const shadowId = String(activeThreadIdShadowRef.current ?? "").trim();
  if (shadowId) return shadowId;

  return null;
}

export function resolveActiveThreadTarget(args: {
  list: Thread[];
  activeThreadIdShadowRef: MutableRefObject<string | null>;
}): ResolveActiveThreadTargetResult {
  const { list, activeThreadIdShadowRef } = args;

  const sortedList = sortThreadsByUpdatedDesc(Array.isArray(list) ? list : []);
  const preferredActiveThreadId = readPreferredActiveThreadId({
    activeThreadIdShadowRef,
  });

  const currentTargetThreadId = pickExistingThreadId(
    sortedList,
    preferredActiveThreadId,
  );

  if (currentTargetThreadId) {
    activeThreadIdShadowRef.current = currentTargetThreadId;
  }

  return {
    sortedList,
    preferredActiveThreadId,
    currentTargetThreadId,
  };
}

export function pickInitialThreadId(args: {
  sortedList: Thread[];
  currentTargetThreadId: string | null;
}): string | null {
  const { sortedList, currentTargetThreadId } = args;

  const restoredId = String(currentTargetThreadId ?? "").trim();
  if (restoredId) return restoredId;

  return String(sortedList[0]?.id ?? "").trim() || null;
}

export function persistActiveThreadId(threadId: string | null) {
  const tid = String(threadId ?? "").trim();
  if (!tid) return;

  try {
    saveActiveThreadId(tid);
  } catch {}
}

export function clearStoredActiveThreadId() {
  try {
    clearActiveThreadId();
  } catch {}
}

/*
このファイルの正式役割:
useChatInitParts.ts から切り出す、初期化時の activeThread 復元補助責務を担う。
保存済み activeThreadId / shadow activeThreadId から復元候補を読み、取得済み threads の中に存在する thread だけを選ぶ。
新規thread作成、messages取得、本文表示、profile / plan / userState 取得、HOPY状態、Compass、confirmed payload の正は作らない。
*/

/*
【今回このファイルで修正したこと】
1. useChatInitParts.ts に混在している activeThread 復元補助責務の受け皿として、新規ファイルを作成しました。
2. 保存済み activeThreadId と shadow activeThreadId を読む処理を readPreferredActiveThreadId として分離しました。
3. threads 一覧から復元可能な activeThread を決める処理を resolveActiveThreadTarget として分離しました。
4. 初期表示に使う thread id を選ぶ処理を pickInitialThreadId として分離しました。
5. activeThreadId の保存・クリア補助を persistActiveThreadId / clearStoredActiveThreadId として分離しました。
6. threads取得、新規thread作成制御、本文表示、送信、MEMORIES には触れていません。
7. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元仕様には触れていません。
*/

/* /components/chat/lib/useChatInitActiveThread.ts */