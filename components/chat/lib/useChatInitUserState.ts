// /components/chat/lib/useChatInitUserState.ts
"use client";

import type { MutableRefObject } from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { errText, logWarn } from "./useChatInitUtils";

export type UseChatInitUserStateParams<TState> = {
  supabase: SupabaseClient<any>;

  setUserState: (v: TState | null) => void;
  setUserStateErr: (v: string | null) => void;

  normalizeState: (x: any) => TState | null;
};

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

    const { data: profileRow, error: profileError } = await p.supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();

    if (!isAlive()) return;
    if (seq !== initSeqRef.current) return;

    if (profileError) {
      throw profileError;
    }

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
1. fetchUserStateOnly() 内の重複した getSessionWithRetry() を削除しました。
2. controller 側で session 確認済みのあとに、profile / plan 取得前でもう一度 session retry へ戻る経路を削除しました。
3. profiles.plan 取得をこのファイルの本線として先に進める形へ戻しました。
4. session 情報は sessionHint が渡された場合だけ userState へ反映する形にしました。
5. 現時点では sessionHint を渡す側のファイルはまだ触っていません。
6. このファイルは threads取得、activeThread復元、新規thread作成制御、本文表示、送信、MEMORIES には触れていません。
7. HOPY唯一の正、confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、DB保存・復元仕様には触れていません。
*/

/* /components/chat/lib/useChatInitUserState.ts */