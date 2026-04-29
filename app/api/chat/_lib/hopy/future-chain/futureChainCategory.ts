// /app/api/chat/_lib/hopy/future-chain/futureChainCategory.ts

export type FutureChainCategoryMajor =
  | "weather"
  | "fashion"
  | "daily_life"
  | "romance"
  | "relationships"
  | "family"
  | "parenting"
  | "caregiving"
  | "health"
  | "mental_health"
  | "sleep"
  | "menopause"
  | "pain"
  | "work"
  | "career"
  | "school"
  | "learning"
  | "creation"
  | "development"
  | "business"
  | "money"
  | "housing"
  | "legal"
  | "shopping"
  | "travel"
  | "food"
  | "beauty"
  | "pets"
  | "community"
  | "sns"
  | "life"
  | "hopy"
  | "other";

export type FutureChainCategoryMinor =
  | "anxiety"
  | "confusion"
  | "overwhelm"
  | "low_energy"
  | "unclear_thoughts"
  | "unclear_feelings"
  | "decision"
  | "practical_choice"
  | "communication"
  | "boundary"
  | "guilt"
  | "repair"
  | "priority_confusion"
  | "task_overload"
  | "first_step"
  | "continuity"
  | "recovery_pause"
  | "readjustment"
  | "pain"
  | "sleep_issue"
  | "risk_awareness"
  | "self_doubt"
  | "future_uncertainty"
  | "value_clarification"
  | "meaning_loss"
  | "comparison"
  | "loneliness"
  | "anger"
  | "sadness"
  | "trust_issue"
  | "role_pressure"
  | "information_search"
  | "planning";

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
  userMessage?: string | null;
  recentUserText?: string | null;
  reply?: string | null;
  handoffMessageSnapshot?: string | null;
};

type MajorCategoryRule = {
  major_category: FutureChainCategoryMajor;
  keywords: string[];
  reason: string;
  confidence?: FutureChainCategoryConfidence;
};

type MinorCategoryRule = {
  minor_category: FutureChainCategoryMinor;
  keywords: string[];
  reason: string;
  confidence?: FutureChainCategoryConfidence;
};

const MAJOR_CATEGORY_RULES: MajorCategoryRule[] = [
  {
    major_category: "hopy",
    keywords: [
      "hopy",
      "HOPY",
      "Future Chain",
      "future chain",
      "Compass",
      "MEMORIES",
      "DASHBOARD",
      "HOPY回答",
      "HOPY開発",
      "HOPY設計",
    ],
    reason: "major:hopy",
  },
  {
    major_category: "weather",
    keywords: ["天気", "気温", "雨", "晴れ", "曇り", "暑い", "寒い", "風", "湿度"],
    reason: "major:weather",
  },
  {
    major_category: "menopause",
    keywords: ["更年期", "ホルモン", "ホットフラッシュ"],
    reason: "major:menopause",
  },
  {
    major_category: "caregiving",
    keywords: [
      "介護",
      "看病",
      "老人ホーム",
      "施設",
      "ケアマネ",
      "要介護",
      "デイサービス",
      "特養",
      "老健",
    ],
    reason: "major:caregiving",
  },
  {
    major_category: "parenting",
    keywords: [
      "子ども",
      "こども",
      "子供",
      "育児",
      "子育て",
      "娘",
      "息子",
      "保育園",
      "幼稚園",
    ],
    reason: "major:parenting",
  },
  {
    major_category: "romance",
    keywords: [
      "恋愛",
      "好きにな",
      "好きです",
      "片思い",
      "告白",
      "付き合",
      "交際",
      "復縁",
      "失恋",
      "別れ",
      "彼氏",
      "彼女",
      "恋人",
      "気になる人",
    ],
    reason: "major:romance",
  },
  {
    major_category: "pain",
    keywords: [
      "痛い",
      "痛み",
      "疼く",
      "違和感",
      "股関節",
      "腰痛",
      "頭痛",
      "腹痛",
      "膝",
      "肩",
      "しびれ",
    ],
    reason: "major:pain",
  },
  {
    major_category: "sleep",
    keywords: ["眠れ", "寝つけ", "寝付け", "睡眠", "寝不足", "眠り", "夜中に起き"],
    reason: "major:sleep",
  },
  {
    major_category: "mental_health",
    keywords: [
      "メンタル",
      "気分が落ち",
      "落ち込",
      "消えたい",
      "死にたい",
      "不眠",
      "うつ",
      "パニック",
    ],
    reason: "major:mental_health",
  },
  {
    major_category: "health",
    keywords: [
      "体調",
      "健康",
      "病院",
      "症状",
      "熱",
      "発熱",
      "薬",
      "診察",
      "受診",
      "検査",
    ],
    reason: "major:health",
  },
  {
    major_category: "fashion",
    keywords: [
      "服装",
      "服",
      "コーデ",
      "着る",
      "着て",
      "羽織",
      "上着",
      "ジャケット",
      "靴",
    ],
    reason: "major:fashion",
  },
  {
    major_category: "beauty",
    keywords: [
      "美容",
      "髪",
      "髪型",
      "肌",
      "メイク",
      "化粧",
      "スキンケア",
      "見た目",
      "印象",
    ],
    reason: "major:beauty",
  },
  {
    major_category: "work",
    keywords: [
      "仕事",
      "職場",
      "上司",
      "同僚",
      "部下",
      "業務",
      "会社",
      "会議",
      "残業",
      "ハラスメント",
    ],
    reason: "major:work",
  },
  {
    major_category: "career",
    keywords: ["キャリア", "転職", "就職", "働き方", "進路", "職業", "退職"],
    reason: "major:career",
  },
  {
    major_category: "family",
    keywords: ["家族", "母", "父", "親", "兄弟", "姉妹", "夫", "妻", "家庭"],
    reason: "major:family",
  },
  {
    major_category: "relationships",
    keywords: [
      "人間関係",
      "友人",
      "友達",
      "知人",
      "相手",
      "距離感",
      "対人",
      "仲直り",
    ],
    reason: "major:relationships",
  },
  {
    major_category: "housing",
    keywords: ["住まい", "家", "住宅", "引っ越し", "引越し", "賃貸", "施設探し"],
    reason: "major:housing",
  },
  {
    major_category: "money",
    keywords: ["お金", "収入", "支出", "貯金", "生活費", "借金", "投資", "費用"],
    reason: "major:money",
  },
  {
    major_category: "legal",
    keywords: ["法律", "契約", "弁護士", "訴訟", "権利", "裁判", "違法"],
    reason: "major:legal",
  },
  {
    major_category: "development",
    keywords: [
      "コード",
      "実装",
      "DB",
      "UI",
      "TypeScript",
      "tsx",
      "SQL",
      "ファイル修正",
      "npm run build",
    ],
    reason: "major:development",
  },
  {
    major_category: "business",
    keywords: ["事業", "起業", "副業", "サービス", "販売", "収益", "価格", "プラン"],
    reason: "major:business",
  },
  {
    major_category: "school",
    keywords: ["学校", "先生", "授業", "クラス", "受験", "学生", "大学", "高校", "中学"],
    reason: "major:school",
  },
  {
    major_category: "learning",
    keywords: ["学習", "勉強", "資格", "語学", "スキル", "学ぶ", "練習"],
    reason: "major:learning",
  },
  {
    major_category: "creation",
    keywords: ["創作", "文章", "小説", "絵", "画像", "音楽", "作品", "発信", "デザイン"],
    reason: "major:creation",
  },
  {
    major_category: "shopping",
    keywords: ["買い物", "商品", "購入", "買う", "比較", "おすすめ"],
    reason: "major:shopping",
  },
  {
    major_category: "travel",
    keywords: ["旅行", "旅", "ホテル", "宿泊", "観光", "移動", "飛行機", "新幹線"],
    reason: "major:travel",
  },
  {
    major_category: "food",
    keywords: ["食事", "ご飯", "夕飯", "昼食", "朝食", "料理", "献立", "外食"],
    reason: "major:food",
  },
  {
    major_category: "pets",
    keywords: ["ペット", "犬", "猫", "動物", "飼う", "飼育"],
    reason: "major:pets",
  },
  {
    major_category: "sns",
    keywords: ["SNS", "X", "Twitter", "インスタ", "投稿", "フォロワー", "炎上"],
    reason: "major:sns",
  },
  {
    major_category: "community",
    keywords: ["地域", "コミュニティ", "グループ", "所属", "集まり"],
    reason: "major:community",
  },
  {
    major_category: "life",
    keywords: ["人生", "生き方", "価値観", "将来", "これから", "理想", "自分らしい"],
    reason: "major:life",
  },
  {
    major_category: "daily_life",
    keywords: ["日常", "家事", "片付け", "掃除", "予定", "暮らし", "生活"],
    reason: "major:daily_life",
  },
];

const MINOR_CATEGORY_RULES: MinorCategoryRule[] = [
  {
    minor_category: "guilt",
    keywords: [
      "声を荒げ",
      "怒ってしま",
      "怒鳴",
      "責めてしま",
      "申し訳",
      "ごめん",
      "罪悪感",
    ],
    reason: "minor:guilt",
  },
  {
    minor_category: "sleep_issue",
    keywords: ["眠れ", "寝つけ", "寝付け", "睡眠", "眠り", "寝不足", "夜中に起き"],
    reason: "minor:sleep_issue",
  },
  {
    minor_category: "pain",
    keywords: ["痛い", "痛み", "疼く", "股関節", "腰痛", "頭痛", "腹痛", "しびれ"],
    reason: "minor:pain",
  },
  {
    minor_category: "overwhelm",
    keywords: [
      "大変",
      "抱え",
      "いっぱいいっぱい",
      "いっぱい",
      "多すぎ",
      "限界",
      "しんど",
      "重い",
    ],
    reason: "minor:overwhelm",
  },
  {
    minor_category: "boundary",
    keywords: [
      "境界",
      "距離感",
      "断る",
      "断り",
      "踏み込",
      "近すぎ",
      "離れ",
      "上司が好き",
      "職場で好き",
      "立場",
    ],
    reason: "minor:boundary",
  },
  {
    minor_category: "risk_awareness",
    keywords: [
      "危険",
      "リスク",
      "ハラスメント",
      "契約",
      "法律",
      "投資",
      "歩けない",
      "強い痛み",
      "発熱",
      "しびれ",
      "自分を傷つけ",
      "誰かを傷つけ",
    ],
    reason: "minor:risk_awareness",
  },
  {
    minor_category: "practical_choice",
    keywords: [
      "なにがいい",
      "何がいい",
      "どれがいい",
      "どっちがいい",
      "おすすめ",
      "選べばいい",
      "着ればいい",
      "食べればいい",
    ],
    reason: "minor:practical_choice",
  },
  {
    minor_category: "information_search",
    keywords: [
      "探したい",
      "探す",
      "検索",
      "調べたい",
      "条件",
      "老人ホームを探",
      "施設を探",
      "病院を探",
    ],
    reason: "minor:information_search",
  },
  {
    minor_category: "communication",
    keywords: ["伝え", "話し方", "言い方", "会話", "声をかけ", "連絡", "返信"],
    reason: "minor:communication",
  },
  {
    minor_category: "repair",
    keywords: ["謝", "仲直り", "修復", "戻したい", "関係を戻", "安心を戻"],
    reason: "minor:repair",
  },
  {
    minor_category: "decision",
    keywords: ["決め", "選択", "選べ", "迷って", "迷う", "判断", "どうするべき"],
    reason: "minor:decision",
  },
  {
    minor_category: "priority_confusion",
    keywords: ["優先順位", "どれから", "何から", "一番先", "順番"],
    reason: "minor:priority_confusion",
  },
  {
    minor_category: "task_overload",
    keywords: ["タスク", "やること", "作業", "締切", "追いつか"],
    reason: "minor:task_overload",
  },
  {
    minor_category: "low_energy",
    keywords: ["疲れ", "気力", "動けない", "やる気が出ない", "だるい", "消耗"],
    reason: "minor:low_energy",
  },
  {
    minor_category: "anxiety",
    keywords: ["不安", "怖い", "こわい", "心配", "焦", "落ち着かない"],
    reason: "minor:anxiety",
  },
  {
    minor_category: "anger",
    keywords: ["腹が立", "怒り", "ムカつ", "許せない", "納得できない"],
    reason: "minor:anger",
  },
  {
    minor_category: "sadness",
    keywords: ["悲しい", "寂しい", "落ち込", "喪失", "泣きたい"],
    reason: "minor:sadness",
  },
  {
    minor_category: "loneliness",
    keywords: ["孤独", "一人で", "ひとりで", "誰にも言えない", "分かってもらえない"],
    reason: "minor:loneliness",
  },
  {
    minor_category: "trust_issue",
    keywords: ["信じて", "信頼", "裏切", "疑って", "信用"],
    reason: "minor:trust_issue",
  },
  {
    minor_category: "role_pressure",
    keywords: ["役割", "責任", "親として", "介護者", "上司として", "作り手"],
    reason: "minor:role_pressure",
  },
  {
    minor_category: "self_doubt",
    keywords: ["自信", "できるか不安", "自分なんて", "向いてない"],
    reason: "minor:self_doubt",
  },
  {
    minor_category: "future_uncertainty",
    keywords: ["将来", "先が見え", "これからどう", "未来が不安"],
    reason: "minor:future_uncertainty",
  },
  {
    minor_category: "value_clarification",
    keywords: ["価値観", "大切にしたい", "本音", "理想", "自分らしい"],
    reason: "minor:value_clarification",
  },
  {
    minor_category: "meaning_loss",
    keywords: ["意味がない", "何のため", "目的がない", "虚しい"],
    reason: "minor:meaning_loss",
  },
  {
    minor_category: "comparison",
    keywords: ["比べ", "比較", "他人と", "劣等感"],
    reason: "minor:comparison",
  },
  {
    minor_category: "first_step",
    keywords: ["最初の一歩", "一歩目", "始め方", "何から始め"],
    reason: "minor:first_step",
  },
  {
    minor_category: "continuity",
    keywords: ["続け", "継続", "習慣", "毎日", "続かない"],
    reason: "minor:continuity",
  },
  {
    minor_category: "recovery_pause",
    keywords: ["休", "休む", "立ち止ま", "焦らず", "無理に"],
    reason: "minor:recovery_pause",
  },
  {
    minor_category: "readjustment",
    keywords: ["立て直", "再調整", "やり直", "戻す", "前提を見直"],
    reason: "minor:readjustment",
  },
  {
    minor_category: "planning",
    keywords: ["計画", "予定", "スケジュール", "手順", "段取り"],
    reason: "minor:planning",
  },
  {
    minor_category: "confusion",
    keywords: ["混乱", "わからない", "分からない", "どうしたら", "頭の中"],
    reason: "minor:confusion",
  },
  {
    minor_category: "unclear_feelings",
    keywords: ["気持ち", "感情", "感じ", "心", "違和感", "引っかか"],
    reason: "minor:unclear_feelings",
  },
  {
    minor_category: "unclear_thoughts",
    keywords: ["整理", "まとまら", "考え", "悩み", "迷い"],
    reason: "minor:unclear_thoughts",
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
  return [
    params.userMessage,
    params.recentUserText,
    params.handoffMessageSnapshot,
    params.reply,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join("\n");
}

function includesAnyKeyword(sourceText: string, keywords: string[]): boolean {
  if (!sourceText) return false;

  const normalizedSourceText = normalizeText(sourceText).toLowerCase();

  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeText(keyword).toLowerCase();
    return normalizedKeyword
      ? normalizedSourceText.includes(normalizedKeyword)
      : false;
  });
}

function resolveMajorCategoryFromRules(sourceText: string): {
  major_category: FutureChainCategoryMajor;
  reason: string;
  confidence: FutureChainCategoryConfidence;
} {
  for (const rule of MAJOR_CATEGORY_RULES) {
    if (includesAnyKeyword(sourceText, rule.keywords)) {
      return {
        major_category: rule.major_category,
        reason: rule.reason,
        confidence: rule.confidence ?? "medium",
      };
    }
  }

  return {
    major_category: "other",
    reason: "major:fallback:other",
    confidence: "low",
  };
}

function resolveMinorCategoryFromRules(sourceText: string): {
  minor_category: FutureChainCategoryMinor;
  reason: string;
  confidence: FutureChainCategoryConfidence;
} {
  for (const rule of MINOR_CATEGORY_RULES) {
    if (includesAnyKeyword(sourceText, rule.keywords)) {
      return {
        minor_category: rule.minor_category,
        reason: rule.reason,
        confidence: rule.confidence ?? "medium",
      };
    }
  }

  return {
    minor_category: "unclear_thoughts",
    reason: "minor:fallback:unclear_thoughts",
    confidence: "low",
  };
}

function resolveCategoryConfidence(
  majorConfidence: FutureChainCategoryConfidence,
  minorConfidence: FutureChainCategoryConfidence,
): FutureChainCategoryConfidence {
  if (majorConfidence === "low" || minorConfidence === "low") {
    return "low";
  }

  if (majorConfidence === "high" && minorConfidence === "high") {
    return "high";
  }

  return "medium";
}

function resolveChangeTriggerKey(
  sourceText: string,
): FutureChainCategoryChangeTriggerKey {
  if (
    includesAnyKeyword(sourceText, [
      "箇条書き",
      "書き出",
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

  if (includesAnyKeyword(sourceText, ["次の一歩", "一歩", "始め"])) {
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

export function resolveFutureChainCategory(
  params: ResolveFutureChainCategoryParams,
): FutureChainCategoryResult {
  const sourceText = buildSourceText(params);
  const majorCategory = resolveMajorCategoryFromRules(sourceText);
  const minorCategory = resolveMinorCategoryFromRules(sourceText);
  const changeTriggerKey = resolveChangeTriggerKey(sourceText);

  return {
    major_category: majorCategory.major_category,
    minor_category: minorCategory.minor_category,
    change_trigger_key: changeTriggerKey,
    confidence: resolveCategoryConfidence(
      majorCategory.confidence,
      minorCategory.confidence,
    ),
    reason: `${majorCategory.reason}:${minorCategory.reason}:${changeTriggerKey}`,
  };
}

/*
【このファイルの正式役割】
HOPY Future Chain / World Learning 共通カテゴリの軽量分類だけを担当する。
userMessage / recentUserText / handoff_message_snapshot / reply から、
major_category / minor_category / change_trigger_key をルールベースで推定する。

major_category は「何の会話か」を示す。
minor_category は「どんな悩み方・詰まり方か」を示す。
change_trigger_key は「どんな支援のきっかけに近いか」を示す。

このファイルは OpenAI API 呼び出し、JSON契約生成、HOPY回答生成、
HOPY回答再要約、Compass再要約、ユーザー発話生文の保存、DB保存、
Future Chain保存判定、state_changed再判定、state_level再判定、
current_phase再判定、Compass表示可否判定、HOPY回答○判定、
recipient_support検索、delivery_event保存、UI表示を担当しない。

【今回このファイルで修正したこと】
- major_category を「支援領域」ではなく「何の会話か」に寄せた。
- weather / fashion / romance / parenting / caregiving / menopause / pain / beauty など、現実の会話場面を分類できるようにした。
- minor_category を「どんな悩み方・詰まり方か」に寄せた。
- practical_choice / guilt / repair / pain / sleep_issue / risk_awareness / information_search など、HOPY回答の方向に関わる詰まり方を分類できるようにした。
- userMessage / recentUserText を受け取れるようにした。
- fallback の major_category を other にし、軽い挨拶などを支援領域に寄せすぎないようにした。
- 「おはようございます」のような軽い入力を action_execution + first_step に寄せる旧構造をやめた。
- HOPY回答やCompassをAIで再要約する処理は入れていない。
- OpenAI JSON契約にカテゴリを増やす処理は入れていない。

/app/api/chat/_lib/hopy/future-chain/futureChainCategory.ts
*/