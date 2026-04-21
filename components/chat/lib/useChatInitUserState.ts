// /components/chat/lib/useChatInitUserState.ts
"use client";

import type { MutableRefObject } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { errText, logWarn } from "./useChatInitUtils";

const USER_STATE_READ_TIMEOUT_MS = 1_800;

export type UseChatInitUserStateParams<TState> = {
  supabase: SupabaseClient<any>;

  setUserState: (v: TState | null) => void;
  setUserStateErr: (v: string | null) => void;

  normalizeState: (x: any) => TState | null;
};

type ProfileReadResult = {
  data: any;
  error: any;
  timedOut?: boolean;
};

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: number | null = null;

  return Promise.race<T>([
    promise,
    new Promise<T>((resolve) => {
      try {
        timer = window.setTimeout(() => resolve(fallback), ms);
      } catch {
        resolve(fallback);
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

export async function fetchUserStateOnly<TState>(args: {
  isAlive: () => boolean;
  initSeqRef: MutableRefObject<number>;
  seq: number;
  paramsRef: MutableRefObject<UseChatInitUserStateParams<TState>>;
  userId: string;
  sessionHint?: Session | null;
}) {
  const { isAlive, initSeqRef, seq, paramsRef, userId, sessionHint } = args;
  const p = paramsRef.current;

  if (!isAlive()) return;
  if (seq !== initSeqRef.current) return;

  p.setUserStateErr(null);

  try {
    const sessionUser = sessionHint?.user ?? null;
    const metadata = (sessionUser?.user_metadata ?? {}) as Record<string, unknown>;

    const resolvedUserName =
      String(
        metadata?.name ??
          metadata?.full_name ??
          metadata?.display_name ??
          sessionUser?.email ??
          "",
      ).trim() || null;

    const resolvedUserImageUrl =
      String(metadata?.avatar_url ?? metadata?.picture ?? "").trim() || null;

    const profileResult = await withTimeout<ProfileReadResult>(
      p.supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", userId)
        .maybeSingle() as unknown as Promise<ProfileReadResult>,
      USER_STATE_READ_TIMEOUT_MS,
      { data: null, error: null, timedOut: true },
    );

    if (!isAlive()) return;
    if (seq !== initSeqRef.current) return;

    if (profileResult?.error) {
      throw profileResult.error;
    }

    if (profileResult?.timedOut) {
      logWarn("[useChatInit] fetchUserStateOnly profile timed out -> continue");
    }

    const profileRow = profileResult?.data ?? null;
    const resolvedPlan = String((profileRow as any)?.plan ?? "").trim() || null;

    const rawState = {
      session: {
        user: {
          id: String(sessionUser?.id ?? userId ?? "").trim() || null,
          email: String(sessionUser?.email ?? "").trim() || null,
          user_metadata: {
            name: String(metadata?.name ?? "").trim() || null,
            full_name: String(metadata?.full_name ?? "").trim() || null,
            display_name: String(metadata?.display_name ?? "").trim() || null,
            avatar_url: String(metadata?.avatar_url ?? "").trim() || null,
            picture: String(metadata?.picture ?? "").trim() || null,
          },
        },
      },
      profile: {
        plan: resolvedPlan,
      },
      user_name: resolvedUserName,
      user_image_url: resolvedUserImageUrl,
      plan: resolvedPlan,
    };

    const normalizedState = p.normalizeState(rawState);

    const mergedState =
      rawState &&
      normalizedState &&
      typeof rawState === "object" &&
      typeof normalizedState === "object"
        ? ({
            ...rawState,
            ...normalizedState,
          } as TState)
        : (normalizedState ?? (rawState as TState));

    p.setUserState(mergedState);
    p.setUserStateErr(null);
  } catch (e) {
    if (!isAlive()) return;
    if (seq !== initSeqRef.current) return;

    p.setUserStateErr(errText(e));
    logWarn("[useChatInit] fetchUserStateOnly error", errText(e));
  }
}

/*
このファイルの正式役割:
useChatInitParts.ts から切り出した、profile / plan / userState 取得責務を担う。
Supabase session と profiles.plan から rawState を作り、normalizeState を通して userState へ反映する。
threads / activeThread / messages / 新規thread作成 / HOPY状態 / Compass / confirmed payload の正は作らない。
*/

/*
【今回このファイルで修正したこと】
1. profiles.plan 取得に USER_STATE_READ_TIMEOUT_MS を追加しました。
2. タブ復帰後に profiles 取得が戻らない場合でも、fetchUserStateOnly() 全体が止まり続けないようにしました。
3. profile 取得 timeout 時は plan=null の userState を作り、controller.init() が threads 取得へ進める余地を残しました。
4. session 再判定、threads 取得、messages 取得、本文表示、送信、MEMORIES には触っていません。
5. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元仕様には触れていません。
*/

/* /components/chat/lib/useChatInitUserState.ts */