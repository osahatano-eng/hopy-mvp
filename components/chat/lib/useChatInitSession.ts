// /components/chat/lib/useChatInitSession.ts
"use client";

import type { MutableRefObject } from "react";
import type { SupabaseClient, Session } from "@supabase/supabase-js";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const STABLE_SESSION_DELAYS = [0, 80, 160, 260, 420, 650, 900, 1200, 1600] as const;
const SESSION_RETRY_DELAYS = [0, 80, 160, 260, 420, 650, 900, 1200, 1600, 2100, 2750] as const;
const SESSION_READ_TIMEOUT_MS = 1_800;

export function isSessionUsable(
  session: Session | null | undefined
): session is Session {
  return Boolean(session?.user?.id);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: number | null = null;

  return Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => {
      try {
        timer = window.setTimeout(() => resolve(null), ms);
      } catch {
        resolve(null);
      }
    }),
  ]).finally(() => {
    if (timer != null) {
      try {
        window.clearTimeout(timer);
      } catch {}
    }
  });
}

async function readSessionOnce(
  supabase: SupabaseClient<any>
): Promise<Session | null> {
  return withTimeout(
    supabase.auth
      .getSession()
      .then(({ data }) => data?.session ?? null)
      .catch(() => null),
    SESSION_READ_TIMEOUT_MS,
  );
}

async function readUsableSession(
  supabase: SupabaseClient<any>
): Promise<Session | null> {
  const session = await readSessionOnce(supabase);
  return isSessionUsable(session) ? session : null;
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
1. isSessionUsable() の有効判定を session.user.id のみに戻しました。
2. タブ復帰直後に access_token 表示値の揺れだけで session なし扱いになり、init 本線へ進めない可能性を減らしました。
3. waitForStableSession / getSessionWithRetry の retry 幅は維持しました。
4. module 共通の sessionReadInFlight / sessionReadStartedAt は戻していません。
5. 初期化本体、threads、messages、profile / plan の正は作っていません。
6. confirmed payload、HOPY唯一の正、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元仕様には触れていません。
*/

/* /components/chat/lib/useChatInitSession.ts */