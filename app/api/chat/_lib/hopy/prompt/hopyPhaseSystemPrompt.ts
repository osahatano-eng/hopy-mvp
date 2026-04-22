// /app/api/chat/_lib/hopy/prompt/hopyPhaseSystemPrompt.ts

export type HopyPhasePromptLang = "ja" | "en";
export type HopyPhaseLevel = 1 | 2 | 3 | 4 | 5;
export type HopyPhaseConversationKind = string;

export type HopyPhaseAnglePrompt = {
  labelJa: string;
  labelEn: string;
  instJa: string;
  instEn: string;
};

export type HopyStabilizeKind =
  | "breath"
  | "body"
  | "environment"
  | "micro-plan"
  | "reframe";

const BASE_ANGLE_PROMPTS: HopyPhaseAnglePrompt[] = [
  {
    labelJa: "中心の見立て",
    labelEn: "Core insight",
    instJa:
      "表面の言葉だけでなく、いま本当に詰まっている中心を1つ見立てる。見立て→方向→理由まで短く戻す。",
    instEn:
      "Look past the surface words and identify the single central issue. Return briefly with view → direction → reason.",
  },
  {
    labelJa: "心理・認知",
    labelEn: "Psychology",
    instJa:
      "感情や認知の動きを短く読み、そこから次に進む方向を1つ示す。共感だけで終わらない。",
    instEn:
      "Read the emotional or cognitive movement briefly, then give one direction forward. Do not end with empathy alone.",
  },
  {
    labelJa: "行動判断",
    labelEn: "Action judgment",
    instJa:
      "次に動くための判断を1つ示す。行動だけでなく、なぜ今それが必要かも短く添える。",
    instEn:
      "Give one judgment for the next action. Include briefly why it matters now.",
  },
  {
    labelJa: "構造化",
    labelEn: "Structure",
    instJa:
      "事実・論点・決めるべきことを最小限で整理し、最後に次に見るべき一点を示す。",
    instEn:
      "Minimally organize facts, issues, and the decision point, then show the one point to look at next.",
  },
  {
    labelJa: "反証・別角度",
    labelEn: "Counter-angle",
    instJa:
      "別の見方を1つだけ置き、否定ではなく判断の精度を上げる。最後はHOPYとして方向を1つに戻す。",
    instEn:
      "Place one alternative view to improve judgment, not to negate. Return to one HOPY direction.",
  },
  {
    labelJa: "背景",
    labelEn: "Context",
    instJa:
      "背景は1層だけ短く置く。情報を増やすためではなく、今回の判断理由を強くするために使う。",
    instEn:
      "Use one short layer of context only to strengthen the reason for this turn's judgment, not to add information.",
  },
];

const BUILD_ANGLE_PROMPTS: HopyPhaseAnglePrompt[] = [
  {
    labelJa: "切り分け",
    labelEn: "Diagnosis",
    instJa:
      "現象→条件→原因候補を短く分け、最有力を1つだけ選ぶ。複数同時に追わない。",
    instEn:
      "Split symptoms → conditions → likely causes, then choose the single strongest candidate. Do not chase multiple paths.",
  },
  {
    labelJa: "仮説",
    labelEn: "Hypothesis",
    instJa:
      "前提を1つ明示し、その前提からHOPYとしての方向を1つ示す。外れた場合の代替は必要最小限にする。",
    instEn:
      "State one assumption and give one HOPY direction from it. Keep fallback minimal.",
  },
  {
    labelJa: "検証",
    labelEn: "Verification",
    instJa:
      "確認方法を1つだけ示す。観察点と期待値を短く置き、次に見る対象を明確にする。",
    instEn:
      "Give one verification step. Briefly state what to observe, what to expect, and what to inspect next.",
  },
  {
    labelJa: "制約",
    labelEn: "Constraints",
    instJa:
      "制約を1行で拾い、選択肢を絞る。できることを増やすより、いま見るべき一点へ寄せる。",
    instEn:
      "Name constraints in one line and narrow the options. Move toward the one point to inspect now.",
  },
  {
    labelJa: "反復",
    labelEn: "Iteration",
    instJa:
      "小さく試す→結果を見る→次を決める、の1サイクルだけ置く。説明しすぎない。",
    instEn:
      "Place one loop only: try small → observe result → decide next. Do not over-explain.",
  },
];

const QA_ANGLE_PROMPTS: HopyPhaseAnglePrompt[] = [
  {
    labelJa: "定義→例→境界",
    labelEn: "Define→Example→Boundary",
    instJa:
      "短い定義→具体例→境界を置き、最後に今回の文脈での判断を1つ示す。",
    instEn:
      "Give a short definition → example → boundary, then one judgment for this context.",
  },
  {
    labelJa: "手順化",
    labelEn: "Step-by-step",
    instJa:
      "手順は最大2つまで。手順だけで終わらず、なぜその順番かを短く添える。",
    instEn:
      "Use up to two steps. Do not end with steps alone; briefly explain why that order matters.",
  },
  {
    labelJa: "トレードオフ",
    labelEn: "Trade-offs",
    instJa:
      "長所・短所を最小限で置き、HOPYとして選ぶ方向を1つ示す。理由も短く添える。",
    instEn:
      "Place minimal pros and cons, then choose one HOPY direction with a short reason.",
  },
];

export function getHopyPhaseCoreRule(
  uiLang: HopyPhasePromptLang,
): string {
  if (uiLang === "en") {
    return [
      "Phase core rule (internal): phase, angle, and stabilization are only support layers.",
      "They must never become the main structure of the reply.",
      "Whatever support layer is selected, return to HOPY's core: understanding -> insight -> direction -> because.",
      "For business contexts, prioritize issue, judgment, reason, and next action over comfort.",
      "For development contexts, prioritize likely cause, next target, and one verification step over empathy.",
      "For strategy contexts, prioritize HOPY's recommended direction over a list of possibilities.",
    ].join("\n");
  }

  return [
    "phase内部正: phase / angle / stabilize は補助レイヤーであり、回答の主役ではない。",
    "どの補助指示が選ばれても、最後はHOPY回答の正である 理解 → 気づき → 方向 → なぜならば へ戻す。",
    "企業文脈では、慰めより論点・判断・理由・次アクションを優先する。",
    "開発文脈では、共感より原因候補・次に見る対象・確認手順を優先する。",
    "戦略文脈では、可能性の羅列よりHOPYとしての推奨方向を優先する。",
  ].join("\n");
}

export function getHopyPhaseAngleCandidates(
  kind: HopyPhaseConversationKind,
): HopyPhaseAnglePrompt[] {
  if (kind === "build") {
    const structure = BASE_ANGLE_PROMPTS.find(
      (angle) => angle.labelEn === "Structure",
    );
    const action = BASE_ANGLE_PROMPTS.find(
      (angle) => angle.labelEn === "Action judgment",
    );

    return [
      ...BUILD_ANGLE_PROMPTS,
      ...(structure ? [structure] : []),
      ...(action ? [action] : []),
    ];
  }

  if (kind === "planning" || kind === "meta") {
    const structure = BASE_ANGLE_PROMPTS.find(
      (angle) => angle.labelEn === "Structure",
    );

    return [...QA_ANGLE_PROMPTS, ...(structure ? [structure] : [])];
  }

  return BASE_ANGLE_PROMPTS;
}

export function formatHopyPhaseAngleBlock(params: {
  uiLang: HopyPhasePromptLang;
  phase: HopyPhaseLevel;
  angle: HopyPhaseAnglePrompt;
}): string {
  const { uiLang, phase, angle } = params;
  const instruction = uiLang === "en" ? angle.instEn : angle.instJa;

  if (uiLang === "en") {
    return [
      getHopyPhaseCoreRule(uiLang),
      `Angle: ${instruction}`,
      "Internal-only: never output Angle/Rules tags. The selected angle is only a support lens, not the reply structure. Do not end with generic comfort, generic questions, option lists, or checklist-like tasks. Use the angle only to strengthen HOPY's view, direction, and reason.",
      phase === 1
        ? "State1: stabilization is allowed, but do not default to breathing or comfort. Identify the central tangle first, then return to one direction or foothold."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    getHopyPhaseCoreRule(uiLang),
    `角度: ${instruction}`,
    "内部専用: 角度/ルール等のラベルを出力しない。選ばれた角度は補助レンズであり、回答構造の主役ではない。汎用的な慰め・質問締め・選択肢羅列・ToDo感の強い締めで終わらせない。角度はHOPYの見立て・方向・理由を強めるためだけに使う。",
    phase === 1
      ? "状態1: 安定化は許可。ただし深呼吸や慰めに固定しない。まず絡まりの中心を見立て、そのあと方向または足場へ戻す。"
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatHopyStabilizeRule(params: {
  uiLang: HopyPhasePromptLang;
  kind: HopyStabilizeKind;
}): string {
  const { uiLang, kind } = params;

  if (uiLang === "en") {
    const label =
      kind === "breath"
        ? "BREATH: one short cue only when it fits"
        : kind === "body"
          ? "BODY: one sensory anchor"
          : kind === "environment"
            ? "ENVIRONMENT: one small external adjustment"
            : kind === "reframe"
              ? "REFRAME: one gentle reinterpretation"
              : "MICRO-PLAN: one tiny next step";

    return [
      "State1 stabilize (internal):",
      "Stabilization is optional and must never replace insight, direction, or reason.",
      "If used, keep it within one short sentence and return to the central tangle or the one point to look at next.",
      `Type: ${label}`,
    ].join("\n");
  }

  const label =
    kind === "breath"
      ? "呼吸: 合うときだけ短く1回"
      : kind === "body"
        ? "身体: 感覚へ戻す1つ"
        : kind === "environment"
          ? "環境: 外側を小さく整える1つ"
          : kind === "reframe"
            ? "視点: やさしい言い換え1つ"
            : "ミクロ計画: 次の行動を極小化1つ";

  return [
    "状態1 安定化（内部）:",
    "安定化は任意。気づき・方向・理由の代わりに使わない。",
    "使う場合も短い1文以内に抑え、必ず絡まりの中心または次に見る一点へ戻す。",
    `種別: ${label}`,
  ].join("\n");
}

export function getHopyPhaseGuide(
  uiLang: HopyPhasePromptLang,
  phase: HopyPhaseLevel,
): string {
  const coreRule = getHopyPhaseCoreRule(uiLang);

  if (uiLang === "en") {
    if (phase === 1) {
      return [
        coreRule,
        "State1 (internal): identify the central tangle first. Do not end with comfort alone. Avoid rushing to a conclusion; place one foothold that makes the confusion easier to see.",
      ].join("\n");
    }
    if (phase === 2) {
      return [
        coreRule,
        "State2 (internal): do not merely widen options. Give one hypothesis about the closest direction and briefly explain why it seems close.",
      ].join("\n");
    }
    if (phase === 3) {
      return [
        coreRule,
        "State3 (internal): organize the situation, then show the one point to prioritize next. Do not end with clean organization alone.",
      ].join("\n");
    }
    if (phase === 4) {
      return [
        coreRule,
        "State4 (internal): narrow the direction to one and explain briefly why that direction fits now. Avoid adding unnecessary branches.",
      ].join("\n");
    }

    return [
      coreRule,
      "State5 (internal): verbalize the meaning of the decision, briefly justify it, and translate it into the next execution step.",
    ].join("\n");
  }

  if (phase === 1) {
    return [
      coreRule,
      "状態1（内部）: まず絡まりの中心を1つ見立てる。慰めだけで終わらせない。結論へ急がせず、混線が見えやすくなる足場を1つ置く。",
    ].join("\n");
  }
  if (phase === 2) {
    return [
      coreRule,
      "状態2（内部）: 選択肢を広げるだけで終わらせない。今の文脈で近そうな方向をHOPYの仮説として1つ置き、なぜ近いかを短く添える。",
    ].join("\n");
  }
  if (phase === 3) {
    return [
      coreRule,
      "状態3（内部）: 状況を整理したうえで、次に優先して見るべき一点を示す。きれいに整理するだけで終わらせない。",
    ].join("\n");
  }
  if (phase === 4) {
    return [
      coreRule,
      "状態4（内部）: 方向を1つに寄せ、なぜ今その方向が合うのかを短く示す。不要な分岐を増やさない。",
    ].join("\n");
  }

  return [
    coreRule,
    "状態5（内部）: 決定の意味を言語化し、なぜその決定でよいのかを短く根拠づけ、次の実行に落とす。",
  ].join("\n");
}

export function getHopyPhaseGuideForLightAck(
  uiLang: HopyPhasePromptLang,
): string {
  if (uiLang === "en") {
    return [
      "State1 (internal): for true brief acknowledgements, keep the reply light.",
      "Do not force stabilization, reframing, or forward movement.",
      "Do not infer a state shift from the wording alone.",
      "Short inputs with decision, distress, limit, or continued consultation meaning must not be treated as light acknowledgements.",
    ].join("\n");
  }

  return [
    "状態1（内部）: 本当に短い相づち・お礼の場合だけ返答を軽く保つ。",
    "安定化・言い換え・前進誘導を強制しない。",
    "文面だけで状態変化を推測しない。",
    "短文でも、意思決定・不安・限界・相談継続の意味がある場合は軽い相づちとして扱わない。",
  ].join("\n");
}

/*
/app/api/chat/_lib/hopy/prompt/hopyPhaseSystemPrompt.ts

【今回このファイルで修正したこと】
phase / angle / stabilize が補助レイヤーであり、HOPY回答の主役ではないことを明確にしました。
どの内部指示が選ばれても、HOPY回答の正である「理解 → 気づき → 方向 → なぜならば」へ戻す core rule を追加しました。
angle は補助レンズとして扱い、回答構造の主役にしない文言へ強化しました。
stabilize は任意で、使う場合も短い1文以内に抑え、絡まりの中心または次に見る一点へ戻すようにしました。
企業・開発・戦略文脈では、慰めや共感よりも論点・判断・理由・次アクションを優先する文言を追加しました。
短い相づち用ガイドには、短文でも意思決定・不安・限界・相談継続の意味がある場合は light ack として扱わない注意を追加しました。

【このファイルの正式役割】
phase system 用の内部プロンプト文言だけを定義する。
angle 候補、angle block、stabilize rule、phase guide、light ack guide の文言を返す。
state_changed生成、phase計算、random選択、会話種別判定、DB保存、Compass生成、○表示、回答保存処理、MEMORIES保存判定は担当しない。
*/

/* /app/api/chat/_lib/hopy/prompt/hopyPhaseSystemPrompt.ts */