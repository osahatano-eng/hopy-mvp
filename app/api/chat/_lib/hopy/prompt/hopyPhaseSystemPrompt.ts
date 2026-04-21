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
      `Angle: ${instruction}`,
      "Internal-only: never output Angle/Rules tags; do not end with generic comfort, generic questions, or checklist-like tasks; keep the reply focused on understanding, insight, direction, and reason.",
      phase === 1
        ? "State1: stabilization is allowed, but do not default to breathing or comfort. Identify the central tangle first."
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  return [
    `角度: ${instruction}`,
    "内部専用: 角度/ルール等のラベルを出力しない。汎用的な慰め・質問締め・ToDo感の強い締めで終わらせない。理解・気づき・方向・理由に戻す。",
    phase === 1
      ? "状態1: 安定化は許可。ただし深呼吸や慰めに固定しない。まず絡まりの中心を見立てる。"
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
      "Stabilization is optional. Do not use it as a substitute for insight or direction.",
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
    "安定化は任意。気づきや方向の代わりに使わない。",
    `種別: ${label}`,
  ].join("\n");
}

export function getHopyPhaseGuide(
  uiLang: HopyPhasePromptLang,
  phase: HopyPhaseLevel,
): string {
  if (uiLang === "en") {
    if (phase === 1) {
      return "State1 (internal): identify the central tangle first. Do not end with comfort alone. Avoid rushing to a conclusion; place one foothold that makes the confusion easier to see.";
    }
    if (phase === 2) {
      return "State2 (internal): do not merely widen options. Give one hypothesis about the closest direction and briefly explain why it seems close.";
    }
    if (phase === 3) {
      return "State3 (internal): organize the situation, then show the one point to prioritize next. Do not end with clean organization alone.";
    }
    if (phase === 4) {
      return "State4 (internal): narrow the direction to one and explain briefly why that direction fits now. Avoid adding unnecessary branches.";
    }
    return "State5 (internal): verbalize the meaning of the decision, briefly justify it, and translate it into the next execution step.";
  }

  if (phase === 1) {
    return "状態1（内部）: まず絡まりの中心を1つ見立てる。慰めだけで終わらせない。結論へ急がせず、混線が見えやすくなる足場を1つ置く。";
  }
  if (phase === 2) {
    return "状態2（内部）: 選択肢を広げるだけで終わらせない。今の文脈で近そうな方向をHOPYの仮説として1つ置き、なぜ近いかを短く添える。";
  }
  if (phase === 3) {
    return "状態3（内部）: 状況を整理したうえで、次に優先して見るべき一点を示す。きれいに整理するだけで終わらせない。";
  }
  if (phase === 4) {
    return "状態4（内部）: 方向を1つに寄せ、なぜ今その方向が合うのかを短く示す。不要な分岐を増やさない。";
  }
  return "状態5（内部）: 決定の意味を言語化し、なぜその決定でよいのかを短く根拠づけ、次の実行に落とす。";
}

export function getHopyPhaseGuideForLightAck(
  uiLang: HopyPhasePromptLang,
): string {
  if (uiLang === "en") {
    return "State1 (internal): for brief acknowledgements, keep the reply light. Do not force stabilization, reframing, or forward movement, and do not infer a state shift from the wording alone.";
  }

  return "状態1（内部）: 短い相づち・お礼では返答を軽く保つ。安定化・言い換え・前進誘導を強制せず、文面だけで状態変化を推測しない。";
}

/*
/app/api/chat/_lib/hopy/prompt/hopyPhaseSystemPrompt.ts

【今回このファイルで修正したこと】
phase/system.ts に混在していた phase system 用の内部プロンプト文言を分離するため、
新規のプロンプト集約ファイルとして作成しました。
HOPY回答の新しい正である「理解 → 気づき → 方向 → なぜならば」を phase 内部指示にも反映し、
状態1..5、angle、stabilize、短い相づち用ガイドの文言をこのファイルで定義できるようにしました。

【このファイルの正式役割】
phase system 用の内部プロンプト文言だけを定義する。
angle 候補、angle block、stabilize rule、phase guide、light ack guide の文言を返す。
state_changed生成、phase計算、random選択、会話種別判定、DB保存、Compass生成、○表示、回答保存処理、MEMORIES保存判定は担当しない。
*/

/* /app/api/chat/_lib/hopy/prompt/hopyPhaseSystemPrompt.ts */