// /app/api/chat/_lib/hopy/future-chain/futureChainCategory.ts

export type FutureChainCategoryMajor =
  | "self_understanding"
  | "emotional_regulation"
  | "relationships"
  | "work_career"
  | "learning_creation"
  | "life_direction"
  | "action_execution"
  | "recovery_resilience"
  | "hopy_usage";

export type FutureChainCategoryMinor =
  | "unclear_thoughts"
  | "unclear_feelings"
  | "overwhelm"
  | "anxiety"
  | "low_energy"
  | "communication"
  | "boundary"
  | "priority_confusion"
  | "career_direction"
  | "task_overload"
  | "skill_learning"
  | "creative_direction"
  | "project_building"
  | "life_choice"
  | "value_clarification"
  | "first_step"
  | "habit_continuation"
  | "recovery_pause"
  | "readjustment"
  | "hopy_understanding"
  | "hopy_direction";

export type FutureChainCategoryChangeTriggerKey =
  | "write_down_one_concern"
  | "name_current_feeling"
  | "notice_inner_reaction"
  | "choose_one_next_step"
  | "narrow_priority"
  | "accept_incomplete_state"
  | "pause_before_action"
  | "break_down_task"
  | "compare_options"
  | "define_success_condition"
  | "ask_one_question"
  | "reconnect_with_reason"
  | "notice_pattern"
  | "continue_small"
  | "handoff_message_snapshot";

export type FutureChainCategoryConfidence = "low" | "medium" | "high";

export type FutureChainCategoryResult = {
  major_category: FutureChainCategoryMajor;
  minor_category: FutureChainCategoryMinor;
  change_trigger_key: FutureChainCategoryChangeTriggerKey;
  confidence: FutureChainCategoryConfidence;
  reason: string;
};

export type ResolveFutureChainCategoryParams = {
  reply?: string | null;
  handoffMessageSnapshot?: string | null;
};

type CategoryRule = {
  major_category: FutureChainCategoryMajor;
  minor_category: FutureChainCategoryMinor;
  keywords: string[];
  reason: string;
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    major_category: "hopy_usage",
    minor_category: "hopy_understanding",
    keywords: [
      "hopy",
      "HOPY",
      "できること",
      "役割",
      "使い方",
      "機能",
      "何ができる",
      "HOPYについて",
      "hopyについて",
    ],
    reason: "hopy_usage:hopy_understanding",
  },
  {
    major_category: "hopy_usage",
    minor_category: "hopy_direction",
    keywords: ["HOPYのこと", "hopyのこと", "HOPYそのもの", "HOPYをどう", "HOPYの方向"],
    reason: "hopy_usage:hopy_direction",
  },
  {
    major_category: "recovery_resilience",
    minor_category: "recovery_pause",
    keywords: ["限界", "だめ", "ダメ", "無理", "しんど", "つらい", "疲れ", "休", "休む"],
    reason: "recovery_resilience:recovery_pause",
  },
  {
    major_category: "emotional_regulation",
    minor_category: "anxiety",
    keywords: ["不安", "怖い", "こわい", "心配", "焦", "落ち着かない"],
    reason: "emotional_regulation:anxiety",
  },
  {
    major_category: "emotional_regulation",
    minor_category: "overwhelm",
    keywords: ["頭の中", "絡ま", "混乱", "いっぱい", "多すぎ", "重い", "モヤモヤ"],
    reason: "emotional_regulation:overwhelm",
  },
  {
    major_category: "relationships",
    minor_category: "communication",
    keywords: ["人間関係", "相手", "伝え", "話し方", "会話", "友人", "家族", "恋愛"],
    reason: "relationships:communication",
  },
  {
    major_category: "relationships",
    minor_category: "boundary",
    keywords: ["距離感", "境界", "断る", "踏み込", "近すぎ", "離れ"],
    reason: "relationships:boundary",
  },
  {
    major_category: "work_career",
    minor_category: "priority_confusion",
    keywords: ["仕事", "優先順位", "どれから", "何から", "タスク", "業務"],
    reason: "work_career:priority_confusion",
  },
  {
    major_category: "work_career",
    minor_category: "career_direction",
    keywords: ["キャリア", "転職", "職場", "働き方", "仕事の方向"],
    reason: "work_career:career_direction",
  },
  {
    major_category: "learning_creation",
    minor_category: "project_building",
    keywords: ["開発", "制作", "プロジェクト", "作りたい", "実装", "UI", "DB", "コード"],
    reason: "learning_creation:project_building",
  },
  {
    major_category: "learning_creation",
    minor_category: "skill_learning",
    keywords: ["学習", "勉強", "学ぶ", "練習", "スキル", "研究"],
    reason: "learning_creation:skill_learning",
  },
  {
    major_category: "life_direction",
    minor_category: "life_choice",
    keywords: ["人生", "将来", "これから", "方向", "選択", "進路"],
    reason: "life_direction:life_choice",
  },
  {
    major_category: "life_direction",
    minor_category: "value_clarification",
    keywords: ["価値観", "大切にしたい", "本音", "理想", "自分らしい"],
    reason: "life_direction:value_clarification",
  },
  {
    major_category: "action_execution",
    minor_category: "first_step",
    keywords: ["一歩", "始め", "まず", "動く", "行動", "やってみる"],
    reason: "action_execution:first_step",
  },
  {
    major_category: "action_execution",
    minor_category: "habit_continuation",
    keywords: ["続け", "継続", "習慣", "毎日", "続かない"],
    reason: "action_execution:habit_continuation",
  },
  {
    major_category: "self_understanding",
    minor_category: "unclear_feelings",
    keywords: ["気持ち", "感情", "感じ", "心", "違和感", "引っかか"],
    reason: "self_understanding:unclear_feelings",
  },
  {
    major_category: "self_understanding",
    minor_category: "unclear_thoughts",
    keywords: ["整理", "まとまら", "考え", "わからない", "悩み", "迷い"],
    reason: "self_understanding:unclear_thoughts",
  },
];

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildSourceText(params: ResolveFutureChainCategoryParams): string {
  return [params.handoffMessageSnapshot, params.reply]
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");
}

function includesAnyKeyword(sourceText: string, keywords: string[]): boolean {
  if (!sourceText) return false;

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword);
    return normalizedKeyword ? sourceText.includes(normalizedKeyword) : false;
  });
}

function resolveChangeTriggerKey(
  sourceText: string,
): FutureChainCategoryChangeTriggerKey {
  if (
    includesAnyKeyword(sourceText, [
      "書き出",
      "紙",
      "メモ",
      "一つだけ書",
      "言葉にして",
    ])
  ) {
    return "write_down_one_concern";
  }

  if (includesAnyKeyword(sourceText, ["気持ち", "感情", "名前", "心"])) {
    return "name_current_feeling";
  }

  if (
    includesAnyKeyword(sourceText, [
      "違和感",
      "引っかか",
      "反応",
      "気になる",
      "気になって",
    ])
  ) {
    return "notice_inner_reaction";
  }

  if (includesAnyKeyword(sourceText, ["次の一歩", "一歩", "まず", "始め"])) {
    return "choose_one_next_step";
  }

  if (includesAnyKeyword(sourceText, ["優先", "絞", "一つに", "一番"])) {
    return "narrow_priority";
  }

  if (
    includesAnyKeyword(sourceText, [
      "途中",
      "まとまらない",
      "まとまらず",
      "無理にまとめ",
      "そのまま",
      "大丈夫",
    ])
  ) {
    return "accept_incomplete_state";
  }

  if (includesAnyKeyword(sourceText, ["休", "止ま", "焦らず", "無理に", "待つ"])) {
    return "pause_before_action";
  }

  if (includesAnyKeyword(sourceText, ["分け", "小さく", "細かく", "分解"])) {
    return "break_down_task";
  }

  if (includesAnyKeyword(sourceText, ["比べ", "比較", "選択肢"])) {
    return "compare_options";
  }

  if (includesAnyKeyword(sourceText, ["成功", "条件", "ゴール", "基準"])) {
    return "define_success_condition";
  }

  if (includesAnyKeyword(sourceText, ["問い", "質問", "聞きたい", "知りたい"])) {
    return "ask_one_question";
  }

  if (includesAnyKeyword(sourceText, ["理由", "なぜ", "目的", "意味"])) {
    return "reconnect_with_reason";
  }

  if (includesAnyKeyword(sourceText, ["傾向", "パターン", "何度も", "繰り返"])) {
    return "notice_pattern";
  }

  if (includesAnyKeyword(sourceText, ["続け", "継続", "積み重ね"])) {
    return "continue_small";
  }

  return "handoff_message_snapshot";
}

function resolveCategoryFromRules(sourceText: string): {
  major_category: FutureChainCategoryMajor;
  minor_category: FutureChainCategoryMinor;
  reason: string;
  confidence: FutureChainCategoryConfidence;
} {
  for (const rule of CATEGORY_RULES) {
    if (includesAnyKeyword(sourceText, rule.keywords)) {
      return {
        major_category: rule.major_category,
        minor_category: rule.minor_category,
        reason: rule.reason,
        confidence: "medium",
      };
    }
  }

  return {
    major_category: "self_understanding",
    minor_category: "unclear_thoughts",
    reason: "fallback:self_understanding:unclear_thoughts",
    confidence: "low",
  };
}

export function resolveFutureChainCategory(
  params: ResolveFutureChainCategoryParams,
): FutureChainCategoryResult {
  const sourceText = buildSourceText(params);
  const category = resolveCategoryFromRules(sourceText);
  const changeTriggerKey = resolveChangeTriggerKey(sourceText);

  return {
    major_category: category.major_category,
    minor_category: category.minor_category,
    change_trigger_key: changeTriggerKey,
    confidence: category.confidence,
    reason: `${category.reason}:${changeTriggerKey}`,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain / World Learning 共通カテゴリの軽量分類だけを担当する。
handoff_message_snapshot / reply から、
major_category / minor_category / change_trigger_key をルールベースで推定する。

このファイルは OpenAI API 呼び出し、JSON契約生成、HOPY回答生成、
HOPY回答再要約、Compass再要約、ユーザー発話生文の保存、DB保存、
Future Chain保存判定、state_changed再判定、state_level再判定、
current_phase再判定、Compass表示可否判定、HOPY回答○判定、
recipient_support検索、delivery_event保存、UI表示を担当しない。

【今回このファイルで修正したこと】
- Future Chain / World Learning 共通で使う major_category の候補を定義した。
- Future Chain / World Learning 共通で使う minor_category の候補を定義した。
- Future Chain / World Learning 共通で使う change_trigger_key の候補を定義した。
- handoff_message_snapshot / reply から軽くカテゴリ推定する resolveFutureChainCategory(...) を追加した。
- HOPY回答やCompassをAIで再要約する処理は入れていない。
- OpenAI JSON契約にカテゴリを増やす処理は入れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainCategory.ts
*/