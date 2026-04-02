// /components/chat/lib/chatTypes.ts
export type Lang = "en" | "ja";

export type HopyPhaseValue = 1 | 2 | 3 | 4 | 5;

export type HopyStateShape = {
  current_phase?: HopyPhaseValue | null;
  currentPhase?: HopyPhaseValue | null;
  phase?: HopyPhaseValue | null;
  state_phase?: HopyPhaseValue | null;
  statePhase?: HopyPhaseValue | null;
  assistant_phase?: HopyPhaseValue | null;
  assistantPhase?: HopyPhaseValue | null;

  state_level?: HopyPhaseValue | null;
  stateLevel?: HopyPhaseValue | null;
  level?: HopyPhaseValue | null;
  assistant_state_level?: HopyPhaseValue | null;
  assistantStateLevel?: HopyPhaseValue | null;

  memory_state_level?: HopyPhaseValue | null;
  memoryStateLevel?: HopyPhaseValue | null;

  stability_score?: number | null;
  stabilityScore?: number | null;
  last_trigger?: string | null;
  updated_at?: string | null;

  state_changed?: boolean | null;
  stateChanged?: boolean | null;
  phase_changed?: boolean | null;
  phaseChanged?: boolean | null;
  assistant_state_changed?: boolean | null;
  assistantStateChanged?: boolean | null;
  memory_state_changed?: boolean | null;
  memoryStateChanged?: boolean | null;
  changed?: boolean | null;

  prev_phase?: HopyPhaseValue | null;
  prevPhase?: HopyPhaseValue | null;
  previous_phase?: HopyPhaseValue | null;
  previousPhase?: HopyPhaseValue | null;
  state_prev_phase?: HopyPhaseValue | null;
  statePrevPhase?: HopyPhaseValue | null;
  assistant_prev_phase?: HopyPhaseValue | null;
  assistantPrevPhase?: HopyPhaseValue | null;
  memory_prev_phase?: HopyPhaseValue | null;
  memoryPrevPhase?: HopyPhaseValue | null;

  prev_state_level?: HopyPhaseValue | null;
  prevStateLevel?: HopyPhaseValue | null;
  previous_state_level?: HopyPhaseValue | null;
  previousStateLevel?: HopyPhaseValue | null;
  assistant_prev_state_level?: HopyPhaseValue | null;
  assistantPrevStateLevel?: HopyPhaseValue | null;
  memory_prev_state_level?: HopyPhaseValue | null;
  memoryPrevStateLevel?: HopyPhaseValue | null;
} | null;

export type ChatMsgCompass = {
  text?: string | null;
  prompt?: string | null;
};

export type ChatMsgConfirmedState = {
  state_level?: HopyPhaseValue | null;
  current_phase?: HopyPhaseValue | null;
  prev_state_level?: HopyPhaseValue | null;
  prev_phase?: HopyPhaseValue | null;
  state_changed?: boolean | null;
};

export type ChatMsgConfirmedThreadSummary = {
  thread_id?: string;
  latest_reply_id?: string;
  latest_reply_at?: string;
  latest_confirmed_state?: ChatMsgConfirmedState | null;
  title?: string;
  next_title?: string;
  title_updated?: boolean;
};

export type ChatMsgConfirmedUiEffects = {
  compass?: ChatMsgCompass | null;
};

export type ChatMsgConfirmedPayload = {
  reply?: string;
  state?: ChatMsgConfirmedState | null;
  thread_summary?: ChatMsgConfirmedThreadSummary | null;
  memory_candidates?: unknown;
  dashboard_signals?: unknown;
  notification_signal?: unknown;
  ui_effects?: ChatMsgConfirmedUiEffects | null;
  compass?: ChatMsgCompass | null;
};

export type ChatMsg = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  created_at?: string;

  compass?: ChatMsgCompass | null;
  compass_text?: string | null;
  compass_prompt?: string | null;
  hopy_confirmed_payload?: ChatMsgConfirmedPayload | null;

  state?: HopyStateShape;
  assistant_state?: HopyStateShape;
  assistantState?: HopyStateShape;
  reply_state?: HopyStateShape;
  replyState?: HopyStateShape;
  hopy_state?: HopyStateShape;
  hopyState?: HopyStateShape;
  memory_state?: HopyStateShape;
  memoryState?: HopyStateShape;

  current_phase?: HopyPhaseValue | null;
  currentPhase?: HopyPhaseValue | null;
  phase?: HopyPhaseValue | null;
  state_phase?: HopyPhaseValue | null;
  statePhase?: HopyPhaseValue | null;
  assistant_phase?: HopyPhaseValue | null;
  assistantPhase?: HopyPhaseValue | null;
  memory_phase?: HopyPhaseValue | null;
  memoryPhase?: HopyPhaseValue | null;

  state_level?: HopyPhaseValue | null;
  stateLevel?: HopyPhaseValue | null;
  assistant_state_level?: HopyPhaseValue | null;
  assistantStateLevel?: HopyPhaseValue | null;
  memory_state_level?: HopyPhaseValue | null;
  memoryStateLevel?: HopyPhaseValue | null;
  level?: HopyPhaseValue | null;

  state_changed?: boolean | null;
  stateChanged?: boolean | null;
  phase_changed?: boolean | null;
  phaseChanged?: boolean | null;
  assistant_state_changed?: boolean | null;
  assistantStateChanged?: boolean | null;
  memory_state_changed?: boolean | null;
  memoryStateChanged?: boolean | null;
  changed?: boolean | null;

  prev_phase?: HopyPhaseValue | null;
  prevPhase?: HopyPhaseValue | null;
  previous_phase?: HopyPhaseValue | null;
  previousPhase?: HopyPhaseValue | null;
  state_prev_phase?: HopyPhaseValue | null;
  statePrevPhase?: HopyPhaseValue | null;
  assistant_prev_phase?: HopyPhaseValue | null;
  assistantPrevPhase?: HopyPhaseValue | null;
  memory_prev_phase?: HopyPhaseValue | null;
  memoryPrevPhase?: HopyPhaseValue | null;

  prev_state_level?: HopyPhaseValue | null;
  prevStateLevel?: HopyPhaseValue | null;
  previous_state_level?: HopyPhaseValue | null;
  previousStateLevel?: HopyPhaseValue | null;
  assistant_prev_state_level?: HopyPhaseValue | null;
  assistantPrevStateLevel?: HopyPhaseValue | null;
  memory_prev_state_level?: HopyPhaseValue | null;
  memoryPrevStateLevel?: HopyPhaseValue | null;
};

export type Thread = {
  id: string;

  /**
   * UI表示名（空は許容するが、表示時は必ずフォールバックする）
   * - 例: "New chat" / "新規チャット"
   */
  title: string;

  /**
   * 一覧の並び替え/即時反映に使う「更新時刻」。
   * - DBに updated_at が無い環境では created_at を代用して入れる
   * - 取得/更新結果で空になることがあるため optional のままにする
   *   （ただし UI/統合側で “可能な限り必ず埋める” のが推奨）
   */
  updated_at?: string;

  /**
   * チャットごとの思考状態レベル（互換維持用）。
   * - public.states.level を参照
   * - 例: 1=混線, 2=模索, 3=整理, 4=収束, 5=決定
   * - 旧実装やDB都合で level が来る場合の受け皿として残す
   */
  state_level?: HopyPhaseValue | null;
  stateLevel?: HopyPhaseValue | null;
  memory_state_level?: HopyPhaseValue | null;
  memoryStateLevel?: HopyPhaseValue | null;
  assistant_state_level?: HopyPhaseValue | null;
  assistantStateLevel?: HopyPhaseValue | null;
  level?: HopyPhaseValue | null;

  /**
   * チャットごとの現在フェーズ。
   * - 1=混線, 2=模索, 3=整理, 4=収束, 5=決定
   * - StateBadge / ヘッダー / 左カラムの個別状態表示で使う
   * - 比較ロジックでも 1..5 を正とする
   */
  current_phase?: HopyPhaseValue | null;
  currentPhase?: HopyPhaseValue | null;
  phase?: HopyPhaseValue | null;
  state_phase?: HopyPhaseValue | null;
  statePhase?: HopyPhaseValue | null;
  assistant_phase?: HopyPhaseValue | null;
  assistantPhase?: HopyPhaseValue | null;
  memory_phase?: HopyPhaseValue | null;
  memoryPhase?: HopyPhaseValue | null;

  /**
   * チャットごとの安定スコア。
   * - -100〜100 を想定
   * - tooltip / 将来のダッシュボード集計で使う
   */
  stability_score?: number | null;

  /**
   * 状態変化のきっかけ情報。
   * - JSON文字列または短文を許容
   * - tooltip の簡易説明や将来の分析用
   */
  last_trigger?: string | null;

  /**
   * 状態そのものの更新時刻。
   * - スレッド updated_at と分離して持てるようにする
   * - 無ければ UI 側で updated_at を代用可能
   */
  state_updated_at?: string | null;

  state_changed?: boolean | null;
  stateChanged?: boolean | null;
  phase_changed?: boolean | null;
  phaseChanged?: boolean | null;
  assistant_state_changed?: boolean | null;
  assistantStateChanged?: boolean | null;
  memory_state_changed?: boolean | null;
  memoryStateChanged?: boolean | null;
  changed?: boolean | null;

  prev_phase?: HopyPhaseValue | null;
  prevPhase?: HopyPhaseValue | null;
  previous_phase?: HopyPhaseValue | null;
  previousPhase?: HopyPhaseValue | null;
  state_prev_phase?: HopyPhaseValue | null;
  statePrevPhase?: HopyPhaseValue | null;
  assistant_prev_phase?: HopyPhaseValue | null;
  assistantPrevPhase?: HopyPhaseValue | null;
  memory_prev_phase?: HopyPhaseValue | null;
  memoryPrevPhase?: HopyPhaseValue | null;

  prev_state_level?: HopyPhaseValue | null;
  prevStateLevel?: HopyPhaseValue | null;
  previous_state_level?: HopyPhaseValue | null;
  previousStateLevel?: HopyPhaseValue | null;
  assistant_prev_state_level?: HopyPhaseValue | null;
  assistantPrevStateLevel?: HopyPhaseValue | null;
  memory_prev_state_level?: HopyPhaseValue | null;
  memoryPrevStateLevel?: HopyPhaseValue | null;

  /**
   * 状態オブジェクトの互換受け皿。
   * - API / DB / 旧実装の揺れを吸収する
   */
  state?: HopyStateShape;
  assistant_state?: HopyStateShape;
  assistantState?: HopyStateShape;
  reply_state?: HopyStateShape;
  replyState?: HopyStateShape;
  hopy_state?: HopyStateShape;
  hopyState?: HopyStateShape;
  memory_state?: HopyStateShape;
  memoryState?: HopyStateShape;
};

/*
このファイルの正式役割
チャット全体で使う型定義ファイル。
messages / threads / state / confirmed payload の受け口を統一する。
Compass や state_changed を各復元経路で落とさないための型の土台。

【今回このファイルで修正したこと】
- ChatMsgCompass に text を追加した。
- ChatMsg に compass_text を追加した。
- threadApiMessages.ts で復元している Compass 情報の受け口を型として合わせた。
*/