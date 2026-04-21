// /app/api/chat/_lib/response/hopyReplyPolicy.ts

import { HOPY_REPLY_POLICY_PROMPT_MAP } from "../hopy/prompt/hopyReplyPolicyPrompt";

export const HOPY_STATE_LEVELS = [1, 2, 3, 4, 5] as const;

export type HopyStateLevel = (typeof HOPY_STATE_LEVELS)[number];

export type HopyStateName =
  | "混線"
  | "模索"
  | "整理"
  | "収束"
  | "決定";

export type HopyReplyPolicy = {
  stateLevel: HopyStateLevel;
  stateName: HopyStateName;
  purpose: readonly string[];
  axis: readonly string[];
  include: readonly string[];
  avoid: readonly string[];
};

const HOPY_REPLY_POLICY_MAP: Record<HopyStateLevel, HopyReplyPolicy> =
  HOPY_REPLY_POLICY_PROMPT_MAP;

export function isHopyStateLevel(value: unknown): value is HopyStateLevel {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

export function normalizeHopyStateLevel(
  value: number | null | undefined,
): HopyStateLevel {
  if (isHopyStateLevel(value)) {
    return value;
  }

  return 1;
}

export function getHopyReplyPolicy(
  stateLevel: number | null | undefined,
): HopyReplyPolicy {
  const normalizedLevel = normalizeHopyStateLevel(stateLevel);
  return HOPY_REPLY_POLICY_MAP[normalizedLevel];
}

export function getAllHopyReplyPolicies(): readonly HopyReplyPolicy[] {
  return HOPY_STATE_LEVELS.map((level) => HOPY_REPLY_POLICY_MAP[level]);
}

/*
このファイルの正式役割
HOPYの5段階状態ごとの返答方針を取得する response policy の入口ファイル。
5段階ごとの回答方針文言そのものは /app/api/chat/_lib/hopy/prompt/hopyReplyPolicyPrompt.ts に集約し、このファイルは型定義・state level 正規化・policy取得関数だけを担当する。
このファイルは本文トーンの方針を返す層であり、state_changed・Compass・○表示の正を決める層ではない。
state_changed と Compass の唯一の正は、回答確定時の hopy_confirmed_payload に従う。
*/

/*
【今回このファイルで修正したこと】
- HOPY_REPLY_POLICY_MAP の5段階回答方針文言の直書きを削除した。
- /app/api/chat/_lib/hopy/prompt/hopyReplyPolicyPrompt.ts から HOPY_REPLY_POLICY_PROMPT_MAP を読み込む形に変更した。
- hopyReplyPolicy.ts を、文言定義ではなく型定義・state level 正規化・policy取得関数の入口責務へ戻した。
- state_changed・Compass・○表示・DB保存復元・回答生成処理には触れていない。
*/

/* /app/api/chat/_lib/response/hopyReplyPolicy.ts */