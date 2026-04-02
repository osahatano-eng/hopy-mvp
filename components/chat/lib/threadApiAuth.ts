// /components/chat/lib/threadApiAuth.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { sleep } from "./threadApiSupport";
import { isTransientAuthOrNetworkError } from "./threadApiErrors";

// ✅ PWA復帰直後は “getSession() が一瞬 null” でも、少し待てば戻ることがある
export async function waitForAuthReady(supabase: SupabaseClient) {
  const delays = [0, 80, 160, 260, 420, 650];

  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await sleep(delays[i]);

    try {
      const { data } = await supabase.auth.getSession();
      const s = data?.session ?? null;
      if (s?.user) return { ok: true as const };
    } catch (e) {
      // auth API 自体が揺れている可能性もあるので継続
      if (i < delays.length - 1 && isTransientAuthOrNetworkError(e)) continue;
    }
  }

  return { ok: false as const };
}