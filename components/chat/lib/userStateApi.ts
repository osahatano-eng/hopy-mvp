// /components/chat/lib/userStateApi.ts
export type UserState = {
  user_id: string;
  current_phase: number;
  stability_score: number;
  last_trigger: string | null;
  updated_at: string | null;
};

function normalizePhase(v: unknown): 1 | 2 | 3 | 4 | 5 {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  const rounded = Math.round(n);
  if (rounded <= 1) return 1;
  if (rounded === 2) return 2;
  if (rounded === 3) return 3;
  if (rounded === 4) return 4;
  return 5;
}

function defaultState(userId: string): UserState {
  const uid = String(userId ?? "").trim();
  return {
    user_id: uid,
    current_phase: 1,
    stability_score: 0,
    last_trigger: null,
    updated_at: null,
  };
}

/**
 * Free では userState を使わない。
 * 会話状態の唯一の正は assistant 回答時に確定したスレッド単位 state。
 * そのため、ここでは通信せず常に既定値を返す。
 */
export async function getUserState(
  userId: string,
  _accessToken?: string
): Promise<UserState> {
  return defaultState(userId);
}

/**
 * Free では userState を保存しない。
 * 呼び出し側をすぐ壊さないため、通信せず入力を正規化して返す。
 */
export async function upsertUserState(
  input: Partial<UserState> & { user_id: string },
  _accessToken?: string
): Promise<UserState> {
  const uid = String(input?.user_id ?? "").trim();
  if (!uid) throw new Error("user_id_empty");

  return {
    user_id: uid,
    current_phase: normalizePhase(input?.current_phase),
    stability_score: Number(input?.stability_score ?? 0),
    last_trigger:
      input?.last_trigger == null ? null : String(input.last_trigger),
    updated_at:
      input?.updated_at == null ? null : String(input.updated_at),
  };
}