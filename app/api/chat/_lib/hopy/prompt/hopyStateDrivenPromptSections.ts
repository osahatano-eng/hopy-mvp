// /app/api/chat/_lib/hopy/prompt/hopyStateDrivenPromptSections.ts

import type {
  HopyReplyPolicy,
  HopyStateLevel,
} from "../../response/hopyReplyPolicy";
import {
  hasHopyExplicitForwardCommitment,
  isHopyLowSignalInput,
} from "./hopyInputSignalResolver";
import {
  buildHopyRegressionAnswerStructureSection,
  buildHopyRegressionGenerationRulesSection,
  buildHopyRegressionStateDensitySection,
  buildHopyRegressionTransitionSection,
} from "./hopyStateRegressionDrivenPromptSections";

export type HopyStateDrivenResolvedPlan = "free" | "plus" | "pro";

export function buildHopyPolicySection(
  policy: HopyReplyPolicy,
  userInput: string,
): string {
  const lowSignal = isHopyLowSignalInput(userInput);
  const purpose = policy.purpose.map((item) => `- ${item}`).join("\n");
  const axis = policy.axis.map((item) => `- ${item}`).join("\n");
  const include = policy.include.map((item) => `- ${item}`).join("\n");
  const avoid = policy.avoid.map((item) => `- ${item}`).join("\n");

  if (lowSignal) {
    return [
      "入力前の参考状態:",
      "- 今回は低シグナル入口入力として扱うこと。",
      "- 入力前参考状態が何であっても、本文上の状態変化を先取りしないこと。",
      "- トーン調整は最小限にとどめ、本文を短く自然に返すこと。",
      "- 行動開始・方針確定・決定状態として読まないこと。",
      "",
      "低シグナル入力での回答目的:",
      "- 会話の入口として自然に受けること。",
      "- 過大解釈を避けること。",
      "- 状態を押し上げることを目的にしないこと。",
      "",
      "低シグナル入力での回答の軸:",
      "- 短くやわらかく返すこと。",
      "- 深い意味づけをしないこと。",
      "- 方向提示は最小か省略でよいこと。",
      "",
      "低シグナル入力で含めるべき要素:",
      "- 自然な受け止め",
      "- 軽い返答",
      "",
      "低シグナル入力で避けるべきこと:",
      "- 決定5前提の押し出し",
      "- 強い行動促進",
      "- 深い整理完了としての読解",
    ].join("\n");
  }

  return [
    `入力前の参考状態: ${policy.stateName} (${policy.stateLevel}/5)`,
    "- これは今回ターンの確定状態ではなく、返答のトーン調整用の参考情報です。",
    "- この参考状態だけを根拠に、今回ターンの state_changed や state 5 を先取りしないでください。",
    "- 参考状態に合わせて本文の圧を強めすぎず、今回入力の重さを優先してください。",
    "",
    "この参考状態での回答目的:",
    purpose,
    "",
    "この参考状態での回答の軸:",
    axis,
    "",
    "回答に含めるべき要素:",
    include,
    "",
    "回答で避けるべきこと:",
    avoid,
  ].join("\n");
}

export function buildHopyExplicitForwardCommitmentSection(
  userInput: string,
): string {
  if (!hasHopyExplicitForwardCommitment(userInput)) return "";

  return [
    "前進表明の解釈ルール:",
    "- 今回の入力には、やることの絞り込み・着手方針・小さな実行意思の明示が含まれる可能性があります。",
    "- 『まずは〜から進めます』『この方針でいきます』『始めます』『やっていきます』のような入力は、軽い相づちや軽い前向き短文と混同しないこと。",
    "- このような入力では、本文上は混線維持だけで返さず、整理や収束へ向かう前進候補として受け止めてよいこと。",
    "- 方針が絞れた・次の一歩が定まった・小さくても着手意思が出た場合は、回答本文ではその前進を自然に扱ってよいこと。",
    "- ただし、state_changed / current_phase / state_level は本文側で作らず、同じ messages 内の状態材料に一致させること。",
    "- 決定完了や強い実行宣言でない入力を、回答本文で決定完了のように扱わないこと。",
  ].join("\n");
}

export function buildHopyTransitionSection(args: {
  currentStateLevel: HopyStateLevel;
  transitionTargetLevel: HopyStateLevel;
  userInput: string;
}): string {
  const lowSignal = isHopyLowSignalInput(args.userInput);
  const explicitForwardCommitment = hasHopyExplicitForwardCommitment(
    args.userInput,
  );
  const regressionSection = buildHopyRegressionTransitionSection(args);

  if (regressionSection) {
    return regressionSection;
  }

  if (explicitForwardCommitment) {
    return [
      "状態参考方針:",
      `- 入力前の参考状態: ${args.currentStateLevel}/5`,
      `- 参考上限目安: ${args.transitionTargetLevel}/5`,
      "- 上の2値は今回ターンの確定結果ではありません。",
      "- 今回の入力には、やることの絞り込み・着手方針・小さな実行意思の明示が含まれる可能性があります。",
      "- 『まずは〜から進めます』『この方針でいきます』『始めます』のような入力は、軽い相づちではなく前進入力候補として本文を作ること。",
      "- 方針が絞れた・次の一歩が見えた・小さくても着手意思が出た場合は、回答本文では前進として受け止めてよいこと。",
      "- ただし、state_changed / current_phase / state_level は本文側で作らず、同じ messages 内の状態材料に一致させること。",
      "- 決定完了ではない入力を、回答本文で state 5 相当の決定完了として扱わないこと。",
      "- Plus / Pro の Compass 有無は、hopy_confirmed_payload.state.state_changed の値に従うこと。",
    ].join("\n");
  }

  if (lowSignal) {
    return [
      "状態参考方針:",
      `- 入力前の参考状態: ${args.currentStateLevel}/5`,
      `- 参考上限目安: ${args.transitionTargetLevel}/5`,
      "- 今回は低シグナル入口入力として扱うこと。",
      "- 上の2値は今回ターンの確定結果ではありません。",
      "- 低シグナル入口入力では、状態を進めること自体を目的にしないこと。",
      "- 低シグナル入口入力だけを根拠に、本文上の状態変化を作らないこと。",
      "- 参考状態や参考上限目安が高くても、それを今回本文の決定根拠にしないこと。",
      "- state_changed / current_phase / state_level は本文側で作らず、同じ messages 内の状態材料に一致させること。",
      "- 会話開始または軽い応答として静かに返すこと。",
    ].join("\n");
  }

  return [
    "状態参考方針:",
    `- 入力前の参考状態: ${args.currentStateLevel}/5`,
    `- 参考上限目安: ${args.transitionTargetLevel}/5`,
    "- 上の2値は今回ターンの確定結果ではありません。",
    "- 参考上限目安は強制到達先ではなく、本文の圧と方向を調整するための補助情報です。",
    "- 入力前の参考状態や参考上限目安だけを見て、本文上の状態変化を先取りしないでください。",
    "- 低シグナル入口入力や軽い短文では、状態前進を作ること自体を目的にしないでください。",
    "- 実質的な意味入力が十分にあり、前進の根拠が明確なときだけ、本文では次の自然な段階へ進める返答にしてください。",
    "- 入口の挨拶だけなら、会話開始として静かに受け、状態変化を本文で作らないでください。",
    "- 軽い短文だけなら、気持ちの受け止めに留め、状態を大きく進めたような本文にしないでください。",
    "- 軽い前向き短文だけを根拠に、決定・実行開始・方針確定として本文を書かないでください。",
    "- 決定完了として扱う本文は、決定・行動開始・方針確定が明確なときだけです。",
    "- state_changed / current_phase / state_level は本文側で作らず、同じ messages 内の状態材料に一致させること。",
    "- 押しつけず、受け取りやすい小さな一歩を含めてください。",
  ].join("\n");
}

export function buildHopyAnswerStructureSection(userInput: string): string {
  const lowSignal = isHopyLowSignalInput(userInput);
  const explicitForwardCommitment =
    hasHopyExplicitForwardCommitment(userInput);
  const regressionSection =
    buildHopyRegressionAnswerStructureSection(userInput);

  if (regressionSection) {
    return regressionSection;
  }

  if (explicitForwardCommitment) {
    return [
      "HOPY回答構成:",
      "- 本体は 理解 → 気づき → 方向 → なぜならば です。",
      "- 今回は、やることの絞り込みや着手意思が明示された入力として扱うこと。",
      "- 理解では、選んだ方向や定まった一歩を受け止めること。",
      "- 気づきでは、何が定まったのかを短く言語化すること。",
      "- 方向では、次の一歩を一段はっきり示してよいこと。",
      "- なぜならばでは、その方向が自然な前進である理由を短く添えること。",
      "- 整理または収束へ向かう前進候補としての自然さを本文に出してよいが、決定完了のようには書かないこと。",
    ].join("\n");
  }

  if (lowSignal) {
    return [
      "HOPY回答構成:",
      "- 本体は 理解 → 気づき → 方向 → なぜならば です。",
      "- ただし今回は低シグナル入口入力として扱うこと。",
      "- 理解の軽い受け止めだけで十分です。",
      "- 気づきは最小か省略でよいです。",
      "- 方向は最小か省略でよいです。",
      "- なぜならばは短く添えるか、省略してもよいです。",
      "- 強い断定や深い意味づけをしないでください。",
    ].join("\n");
  }

  return [
    "HOPY回答構成:",
    "- 本体は 理解 → 気づき → 方向 → なぜならば です。",
    "- ただし毎回4要素を同じ量で出してはいけません。",
    "- 低シグナル入口入力では、理解の軽い受け止めだけで十分です。",
    "- 軽い短文では、気づき・方向・なぜならばは最小表示にしてください。",
    "- 軽い前向き短文でも、方向を強く断定しないでください。",
    "- 説明要求では、構造を持って深く返してよいです。",
    "- 軽い入力では最小表示、説明要求では深くしてよいです。",
  ].join("\n");
}

export function buildHopyStateDensitySection(
  stateLevel: HopyStateLevel,
  userInput: string,
): string {
  const lowSignal = isHopyLowSignalInput(userInput);
  const explicitForwardCommitment =
    hasHopyExplicitForwardCommitment(userInput);
  const regressionSection = buildHopyRegressionStateDensitySection(userInput);

  if (regressionSection) {
    return regressionSection;
  }

  if (explicitForwardCommitment) {
    return [
      "参考状態別本文密度:",
      "- 今回の入力には、方針の絞り込みや着手意思が含まれます。",
      "- 入力前参考状態が低くても、本文を混線の受け止めだけに固定しないでください。",
      "- やることが見えた、進め方が定まった、ここから始める意思が出た場合は、本文では前進候補として受け止めてよいです。",
      "- ただし、state_changed / current_phase / state_level は本文側で作らず、同じ messages 内の状態材料に一致させること。",
      "- 決定完了ではない入力を、回答本文で決定完了のように扱わないでください。",
    ].join("\n");
  }

  if (lowSignal) {
    return [
      "参考状態別本文密度:",
      "- 今回は低シグナル入口入力です。",
      "- 入力前参考状態が何であっても、本文密度を厚くしすぎないでください。",
      "- 決定・実行開始・整理完了として読まないでください。",
      "- state_changed / current_phase / state_level は本文側で作らず、同じ messages 内の状態材料に一致させること。",
      "- 短く自然に返すことを優先してください。",
    ].join("\n");
  }

  if (stateLevel === 1) {
    return [
      "参考状態別本文密度:",
      "- 入力前参考状態は混線です。",
      "- これは今回ターンの確定状態ではありません。",
      "- 慰めだけで終わらせず、優先するものを少し見えやすくしてください。",
    ].join("\n");
  }

  if (stateLevel === 2) {
    return [
      "参考状態別本文密度:",
      "- 入力前参考状態は模索です。",
      "- これは今回ターンの確定状態ではありません。",
      "- 選択肢を増やしすぎず、今の流れに合う一本を寄せてください。",
      "- ただし今回入力が軽い場合は、方向を厚くしすぎないでください。",
    ].join("\n");
  }

  if (stateLevel === 3) {
    return [
      "参考状態別本文密度:",
      "- 入力前参考状態は整理です。",
      "- これは今回ターンの確定状態ではありません。",
      "- 残すものと捨てるものが少し見えるようにしてください。",
    ].join("\n");
  }

  if (stateLevel === 4) {
    return [
      "参考状態別本文密度:",
      "- 入力前参考状態は収束です。",
      "- これは今回ターンの確定状態ではありません。",
      "- 余計に広げず、最後の絞り込みや実行準備を示してください。",
    ].join("\n");
  }

  return [
    "参考状態別本文密度:",
    "- 入力前参考状態は決定です。",
    "- これは今回ターンの確定状態ではありません。",
    "- 実行・継続・次の確認行動へ落としてください。",
    "- ただし今回入力に明確な決定根拠がない限り、その回の state 5 や state_changed=true を本文側で先取りしないでください。",
  ].join("\n");
}

export function buildHopyGenerationRulesSection(
  resolvedPlan: HopyStateDrivenResolvedPlan,
  userInput: string,
): string {
  const lowSignal = isHopyLowSignalInput(userInput);
  const explicitForwardCommitment =
    hasHopyExplicitForwardCommitment(userInput);
  const regressionSection = buildHopyRegressionGenerationRulesSection({
    resolvedPlan,
    userInput,
  });

  const planSpecificRules =
    resolvedPlan === "pro"
      ? [
          "- Pro 利用中の相手に Free / Plus を自発的な代替案として差し込まないこと",
        ]
      : resolvedPlan === "plus"
        ? [
            "- Plus 利用中の相手に Free を主推奨として着地させないこと",
          ]
        : [
            "- Free でも共感だけで終わらず、シンプルな方向提示まで到達すること",
          ];

  if (regressionSection) {
    return regressionSection;
  }

  if (explicitForwardCommitment) {
    return [
      "回答生成ルール:",
      "- 今回の入力には、やることの絞り込み・着手方針・小さな実行意思の明示が含まれる可能性があります。",
      "- このファイルで渡している入力前参考状態や参考上限目安は補助情報であり、その回の確定 state を意味しないこと。",
      "- state_changed / current_phase / state_level は本文側で作らず、同じ messages 内の状態材料に一致させること。",
      "- 方針が絞れた・次の一歩が定まった・小さくても着手意思が出た場合は、本文では前進候補として自然に扱ってよいこと。",
      "- そのような回は、軽い前向き短文や軽い相づちと混同せず、本文では整理または収束へ向かう流れとして扱ってよいこと。",
      "- ただし、決定完了や強い実行宣言でない入力を、本文で決定完了のように扱わないこと。",
      "- 本文は 理解 → 気づき → 方向 → なぜならば の順を基本に組み立てること。",
      "- 方向では複数案を広げすぎず、ここから進める一歩を1本で示すこと。",
      "- Plus / Pro の Compass 有無は、hopy_confirmed_payload.state.state_changed の値に従うこと。",
      "- 最終 reply が、安心だけ・言い換えだけ・一般論だけで終わっていないか確認すること。",
      "- 必要な回では、HOPYとしての見立て、方向、理由が入っていること。",
      "- 低シグナル入力以外では、必ず『HOPYはこう考えます』に相当する見立てを本文に残すこと。",
      "- 未来予測・方針相談・具体提案要求では、必ずHOPYとしての見立て、なぜそう考えるか、今やることを本文に入れること。",
      "- 『1年後どうなるか』『今やるべきこと』『具体的に教えて』のような入力では、一般論ではなくHOPYの推測・根拠・具体行動として返すこと。",
      "- 『〜できるでしょう』『〜近づくでしょう』だけで終わらず、HOPYの判断と行動への落とし込みまで返すこと。",
      ...planSpecificRules,
    ].join("\n");
  }

  if (lowSignal) {
    return [
      "回答生成ルール:",
      "- 今回は低シグナル入口入力として扱うこと。",
      "- このファイルで渡している入力前参考状態や参考上限目安は補助情報であり、その回の確定 state を意味しないこと。",
      "- このファイルの参考情報だけを根拠に、その回の state_changed / current_phase / state_level を決め打ちしないこと。",
      "- state_changed / current_phase / state_level は本文側で作らず、同じ messages 内の状態材料に一致させること。",
      "- 低シグナル入口入力では、状態前進を作ること自体を目的にしないこと。",
      "- 低シグナル入口入力だけを根拠に、本文上の状態変化を作らないこと。",
      "- 低シグナル入口入力だけを根拠に、Compass を必要とする意味づけをしないこと。",
      "- 挨拶や軽い短文では、短く自然に返すこと。",
      "- 深い気づきや強い方向提示を入れないこと。",
      "- 行動開始・方針確定・決定完了として扱わないこと。",
      ...planSpecificRules,
    ].join("\n");
  }

  return [
    "回答生成ルール:",
    "- 今回の回答は、入力の重さ・深さ・説明要求に合う自然な返答を優先すること。",
    "- このファイルで渡している入力前参考状態や参考上限目安は補助情報であり、その回の確定 state を意味しないこと。",
    "- このファイルの参考情報だけを根拠に、その回の state_changed / current_phase / state_level を決め打ちしないこと。",
    "- state_changed / current_phase / state_level は本文側で作らず、同じ messages 内の状態材料に一致させること。",
    "- 低シグナル入口入力や軽い短文では、状態前進を作ること自体を目的にしないこと。",
    "- 低シグナル入口入力だけを根拠に、本文上の状態変化を作らないこと。",
    "- 低シグナル入口入力だけを根拠に、current_phase / state_level を 5 へ飛ばしたような本文にしないこと。",
    "- 低シグナル入口入力だけを根拠に、Compass を必要とする意味づけをしないこと。",
    "- 短文の軽い感想・軽い前向き発話・軽い応援だけを根拠に、決定・行動開始・方針確定を作らないこと。",
    "- 短文だけを根拠に、決意・決定・整理完了・行動確定まで読み込まないこと。",
    "- 軽い前向き短文と、明確な決断表明を混同しないこと。",
    "- 決定完了として扱う本文は、明確な決定・行動開始・方針確定・強い意志表明があるときだけです。",
    "- 基本は短めに始め、必要なときだけ深くすること。",
    "- 挨拶・軽い入口では短く返すこと。",
    "- 軽い短文では、短く返しつつ過剰な意味づけをしないこと。",
    "- 重い相談では、受け止めを少し厚くしてよいが、感情表現を盛りすぎないこと。",
    "- 説明要求では構造と納得感を優先してよいこと。",
    "- ただ共感して終わらず、必要なときだけ輪郭・気づき・次の一歩のどれかを自然に前進させること。",
    "- 本文は 理解 → 気づき → 方向 → なぜならば の順を基本に組み立てること。",
    "- 低シグナル入口入力では、気づきと方向は最小か省略でよいこと。",
    "- 軽い短文では、理解を軽く受け止める範囲に留めてよいこと。",
    "- なぜならばは短くてもよいが、必要な回では必ず添えること。",
    "- 方向では複数案を広げすぎず、できるだけ一本で示すこと。",
    "- 必要な場合だけ、小さく具体的な提案を1つ入れてよいこと。",
    "- 最終 reply が、安心だけ・言い換えだけ・一般論だけで終わっていないか確認すること。",
    "- 必要な回では、HOPYとしての見立て、方向、理由が入っていること。",
    "- 低シグナル入力以外では、必ず『HOPYはこう考えます』に相当する見立てを本文に残すこと。",
    "- 未来予測・方針相談・具体提案要求では、必ずHOPYとしての見立て、なぜそう考えるか、今やることを本文に入れること。",
    "- 『1年後どうなるか』『今やるべきこと』『具体的に教えて』のような入力では、一般論ではなくHOPYの推測・根拠・具体行動として返すこと。",
    "- 『〜できるでしょう』『〜近づくでしょう』だけで終わらず、HOPYの判断と行動への落とし込みまで返すこと。",
    ...planSpecificRules,
  ].join("\n");
}

/*
【このファイルの正式役割】
HOPYの状態依存の回答制御セクション群をまとめる専用ファイル。
低シグナル入口入力、前進表明、状態遷移、本文密度、回答生成ルールなど、状態や入力の意味に応じて変化する prompt section 文言だけを担当する。
下降専用の詳細ルールは別ファイルへ分離し、このファイルは前進・低シグナル・通常ルールの管理と、下降専用ファイルの受け取りに責務を絞る。
DB取得、DB保存、state_changed生成、Compass生成、○表示、messages取得、回答保存処理、最終組み立て順の決定は担当しない。

【今回このファイルで修正したこと】
- 前進表明・低シグナル・通常入力の状態駆動promptから、モデル自身に state_changed / current_phase / state_level を確定させる文言を削除しました。
- 本文では前進候補・軽い入口・通常入力として扱う余地を残しつつ、state_changed / current_phase / state_level は同じ messages 内の状態材料へ一致させる境界に変更しました。
- current と prev の差分から state_changed を作る文言を削除しました。
- Plus / Pro の Compass 有無は、hopy_confirmed_payload.state.state_changed に従う文言へ変更しました。
- 下降専用セクションの受け取り構造、回答構成、本文密度、plan別ルール、DB、UI、Future Chain保存処理には触れていません。

/app/api/chat/_lib/hopy/prompt/hopyStateDrivenPromptSections.ts
*/