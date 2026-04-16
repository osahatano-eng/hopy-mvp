// /components/chat/lib/useChatInitSession.ts
"use client";

import type { MutableRefObject } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const STABLE_SESSION_DELAYS = [0, 80, 160, 260, 420, 650, 900] as const;
const SESSION_RETRY_DELAYS = [0, 80, 160, 260, 420, 650, 900, 1200, 1600, 2100, 2750] as const;

export function isSessionUsable(
  session: Session | null | undefined
): session is Session {
  return Boolean(session?.user?.id) && Boolean(String(session?.access_token ?? "").trim());
}

async function readUsableSession(
  supabase: SupabaseClient<any>
): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session ?? null;
    return isSessionUsable(session) ? session : null;
  } catch {
    return null;
  }
}

export async function waitForStableSession(args: {
  isAlive: () => boolean;
  supabase: SupabaseClient<any>;
}): Promise<Session | null> {
  const { isAlive, supabase } = args;

  for (const delay of STABLE_SESSION_DELAYS) {
    if (!isAlive()) return null;

    if (delay > 0) {
      await sleep(delay);
    }

    if (!isAlive()) return null;

    const session = await readUsableSession(supabase);
    if (session) return session;
  }

  return null;
}

export type ShouldHandleAuthRefs = {
  handledInitialSessionRef: MutableRefObject<boolean>;
  lastAuthEventRef: MutableRefObject<{ key: string; at: number }>;
  AUTH_EVENT_DEDUPE_MS: number;
};

export function shouldHandleAuthEventWithRefs(
  refs: ShouldHandleAuthRefs,
  event: string,
  session: Session | null
): boolean {
  const ev = String(event ?? "").trim();

  if (ev === "INITIAL_SESSION") {
    if (!session?.user) return false;
    if (refs.handledInitialSessionRef.current) return false;
    refs.handledInitialSessionRef.current = true;
    return true;
  }

  const uid = String(session?.user?.id ?? "");
  const key = `${ev}:${uid}`;
  const now = Date.now();
  const last = refs.lastAuthEventRef.current;

  if (last.key === key && now - last.at <= refs.AUTH_EVENT_DEDUPE_MS) return false;

  refs.lastAuthEventRef.current = { key, at: now };
  return true;
}

export async function getSessionWithRetry(args: {
  isAlive: () => boolean;
  initSeqRef: MutableRefObject<number>;
  seq: number;
  supabase: SupabaseClient<any>;
  hint?: Session | null;
}): Promise<Session | null> {
  const { isAlive, initSeqRef, seq, supabase, hint } = args;
  if (isSessionUsable(hint)) return hint;

  for (const delay of SESSION_RETRY_DELAYS) {
    if (!isAlive()) return null;
    if (seq !== initSeqRef.current) return null;

    if (delay > 0) {
      await sleep(delay);
    }

    if (!isAlive()) return null;
    if (seq !== initSeqRef.current) return null;

    const session = await readUsableSession(supabase);
    if (session) return session;
  }

  return null;
}

/*
このファイルの正式役割:
useChatInit 系で使う session 判定・retry 補助責務だけを持つ責務ファイル。
session の有効判定、auth event の重複処理判定、session 再取得 retry、stable session 待機を担う。
初期化本体、threads 整形、event handler 本体は持たない。
*/

/*
【今回このファイルで修正したこと】
1. Supabase から usable な session を読む責務を readUsableSession に一本化しました。
2. mount 時と tab復帰時で共通利用できる waitForStableSession を追加しました。
3. getSessionWithRetry も同じ session 読み出し本線を使うように揃えました。
4. auth event 重複判定、confirmed payload、HOPY唯一の正、状態値 1..5 / 5段階には触っていません。
*/

/* /components/chat/lib/useChatInitSession.ts */

/*
【今回このファイルで修正したこと】
stable session を待つ共通入口を追加し、
session 補助責務の読み方を1本道に揃えました。
*/