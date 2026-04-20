// /components/chat/lib/threadApiAuth.ts
import type { SupabaseClient, Session } from "@supabase/supabase-js";
import { sleep } from "./threadApiSupport";
import { isTransientAuthOrNetworkError } from "./threadApiErrors";

function isAuthReadySession(session: Session | null | undefined): session is Session {
  return Boolean(session?.user?.id) && Boolean(String(session?.access_token ?? "").trim());
}

// PWA復帰直後は getSession() が一瞬不安定でも、少し待てば戻ることがある
export async function waitForAuthReady(supabase: SupabaseClient) {
  const delays = [0, 80, 160, 260, 420, 650, 900, 1200, 1600];

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i]);

    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session ?? null;
      if (isAuthReadySession(session)) return { ok: true as const };
    } catch (e) {
      if (i < delays.length - 1 && isTransientAuthOrNetworkError(e)) continue;
    }
  }

  return { ok: false as const };
}

/*
このファイルの正式役割:
threadApi 系の取得前に、Supabase auth session が取得処理に使える状態かを確認する補助ファイル。
PWA / タブ復帰直後の一時的な session 不安定を短く待ち、取得系の本線へ進めるかだけを判定する。
*/

/*
【今回このファイルで修正したこと】
1. waitForAuthReady の待機時間を 650ms までから 1600ms までに延ばしました。
2. waitForStableSession と同じ最大待機幅にそろえ、tab復帰直後の auth 復旧待ちを threadApi 側でも短すぎないようにしました。
3. auth ready 判定は user.id + access_token 必須のまま維持しました。
4. confirmed payload、state_changed、HOPY回答○、Compass、状態値 1..5 / 5段階、本文採用判定、DB保存/復元仕様には触っていません。
*/

/* /components/chat/lib/threadApiAuth.ts */