// /components/chat/lib/useChatInitSession.ts
"use client";

import type { MutableRefObject } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const STABLE_SESSION_DELAYS = [0, 80, 160, 260, 420, 650, 900, 1200, 1600] as const;
const SESSION_RETRY_DELAYS = [0, 80, 160, 260, 420, 650, 900, 1200, 1600, 2100, 2750] as const;

export function isSessionUsable(
  session: Session | null | undefined
): session is Session {
  return Boolean(session?.user?.id) && Boolean(String(session?.access_token ?? "").trim());
}

export function isSessionPresent(
  session: Session | null | undefined
): session is Session {
  return Boolean(session?.user?.id);
}

async function readPresentSession(
  supabase: SupabaseClient<any>
): Promise<Session | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session ?? null;
    return isSessionPresent(session) ? session : null;
  } catch {
    return null;
  }
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

async function pollSession(args: {
  isAlive: () => boolean;
  supabase: SupabaseClient<any>;
  delays: readonly number[];
  read: (supabase: SupabaseClient<any>) => Promise<Session | null>;
  canContinue?: () => boolean;
}): Promise<Session | null> {
  const { isAlive, supabase, delays, read, canContinue } = args;

  for (const delay of delays) {
    if (!isAlive()) return null;
    if (canContinue && !canContinue()) return null;

    if (delay > 0) {
      await sleep(delay);
    }

    if (!isAlive()) return null;
    if (canContinue && !canContinue()) return null;

    const session = await read(supabase);
    if (session) return session;
  }

  return null;
}

export async function waitForStableSession(args: {
  isAlive: () => boolean;
  supabase: SupabaseClient<any>;
}): Promise<Session | null> {
  const { isAlive, supabase } = args;

  return pollSession({
    isAlive,
    supabase,
    delays: STABLE_SESSION_DELAYS,
    read: readUsableSession,
  });
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

  return pollSession({
    isAlive,
    supabase,
    delays: SESSION_RETRY_DELAYS,
    read: readUsableSession,
    canContinue: () => seq === initSeqRef.current,
  });
}

/*
このファイルの正式役割:
useChatInit 系で使う session 判定・retry 補助責務だけを持つ責務ファイル。
session の有効判定、auth event の重複処理判定、session 再取得 retry、stable session 待機を担う。
初期化本体、threads 整形、event handler 本体は持たない。
*/

/*
【今回このファイルで修正したこと】
1. waitForStableSession の read を readPresentSession から readUsableSession に変更しました。
2. stable session 判定でも user.id だけではなく access_token まで必須にしました。
3. これにより、tab復帰直後の中途半端な session を安定 session として扱わず、usable session になるまで待つようにしました。
4. auth event 重複判定、confirmed payload、HOPY唯一の正、状態値 1..5 / 5段階には触っていません。
*/

/* /components/chat/lib/useChatInitSession.ts */