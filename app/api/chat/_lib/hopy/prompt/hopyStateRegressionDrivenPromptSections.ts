// /app/api/chat/_lib/hopy/prompt/hopyStateRegressionDrivenPromptSections.ts

import type { HopyStateLevel } from "../../response/hopyReplyPolicy";

export type HopyStateRegressionResolvedPlan = "free" | "plus" | "pro";

function normalizeRegressionSignalInput(userInput: string): string {
  return typeof userInput === "string"
    ? userInput.replace(/\s+/g, "").trim()
    : "";
}

export function hasHopyExplicitBackwardSignal(userInput: string): boolean {
  const compact = normalizeRegressionSignalInput(userInput);
  if (!compact) return false;

  const backwardSignals = [
    "決めたつもり",
    "やっぱり",
    "また迷",
    "迷いが出て",
    "迷いが戻",
    "自信がなくな",
    "自信が揺ら",
    "判断軸に自信がなく",
    "方向が揺ら",
    "わからなくな",
    "決めきれなくな",
    "定まらなくな",
    "絞れなくな",
    "戻ってしま",
    "やり直したい",
    "不安にな",
    "不安が戻",
    "怖くな",
    "これでいいのかわから",
    "本当にこれでいいのか",
  ];

  return backwardSignals.some((signal) => compact.includes(signal));
}

export function buildHopyExplicitBackwardSignalSection(
  userInput: string,
): string {
  if (!hasHopyExplicitBackwardSignal(userInput)) return "";

  return [
    "下降シグナルの解釈ルール:",
    "- 今回の入力には、再迷い・判断軸の揺らぎ・いったん定めた方向への不安の戻りが含まれる可能性があります。",
    "- 『決めたつもりだったがまた迷っている』『やっぱり自信がなくなった』『方向が揺らいだ』のような入力は、整理や収束の同値維持と混同しないこと。",
    "- このような入力は、失敗断定ではなく、再調整が必要になった状態変化候補として扱ってよいこと。",
    "- 再迷い・再拡散・判断軸の揺らぎが意味上明確なら、prev と current を同値固定しないこと。",
    "- その場合は、current_phase / state_level を下げる判断を許容し、state_changed=true を正として返してよいこと。",
    "- Plus / Pro でその結果 state_changed=true なら Compass を必ず返すこと。",
    "- 下降Compassは装飾ではなく、なぜ戻ったのかを説明する根拠として扱うこと。",
  ].join("\n");
}

export function buildHopyRegressionTransitionSection(args: {
  currentStateLevel: HopyStateLevel;
  transitionTargetLevel: HopyStateLevel;
  userInput: string;
}): string {
  if (!hasHopyExplicitBackwardSignal(args.userInput)) return "";

  return [
    "下降時の状態遷移方針:",
    `- 入力前の参考状態: ${args.currentStateLevel}/5`,
    `- 参考上限目安: ${args.transitionTargetLevel}/5`,
    "- 上の2値は今回ターンの確定結果ではありません。",
    "- 今回の入力に、再迷い・判断軸の揺らぎ・いったん定めた方向への不安の戻りが含まれる場合があります。",
    "- このような入力は、前進失敗ではなく、再調整が必要になった状態変化候補として扱ってよいこと。",
    "- 『決めたつもりだったがまた迷っている』『やっぱり自信がなくなった』『方向が揺らいだ』の意味なら、prev と current を同値固定しないこと。",
    "- その場合は、current_phase / state_level を下げる判断を許容すること。",
    "- 再迷い・再拡散・判断軸の揺らぎが意味上明確なら、state_changed=true を正として返してよいこと。",
    "- Plus / Pro でその結果 state_changed=true なら Compass を必ず返すこと。",
    "- 下降は装飾ではなく、なぜ戻ったのかを説明する重要な変化として扱うこと。",
  ].join("\n");
}

export function buildHopyRegressionAnswerStructureSection(
  userInput: string,
): string {
  if (!hasHopyExplicitBackwardSignal(userInput)) return "";

  return [
    "下降時のHOPY回答構成:",
    "- 本体は 理解 → 気づき → 方向 → なぜならば です。",
    "- 今回は、いったん定めた方向への迷い直しや判断軸の揺らぎが出た入力として扱うこと。",
    "- 理解では、戻ってしまったこと自体を失敗扱いせず、再び迷いが出た現在地を受け止めること。",
    "- 気づきでは、何が揺らいだのか、どこで自信が落ちたのかを短く言語化すること。",
    "- 方向では、広げ直すより、再確認すべき軸を1本に絞って示すこと。",
    "- なぜならばでは、その軸を再確認するべき理由を短く添えること。",
    "- 下降回でも、HOPYとしての見立て・方向・理由を弱めないこと。",
  ].join("\n");
}

export function buildHopyRegressionStateDensitySection(
  userInput: string,
): string {
  if (!hasHopyExplicitBackwardSignal(userInput)) return "";

  return [
    "下降時の参考状態別本文密度:",
    "- 今回の入力には、再迷い・方向の揺らぎ・判断軸への自信低下が含まれる可能性があります。",
    "- 入力前参考状態が整理や収束でも、今回ターンの確定状態まで同値固定しないでください。",
    "- いったん見えた方向が揺らいだ、判断軸に自信が持てなくなった、また迷いが出たなら、下降方向の変化候補として扱ってよいです。",
    "- 下降回でも本文を弱くしすぎず、再確認すべき軸を見えやすくしてください。",
  ].join("\n");
}

export function buildHopyRegressionGenerationRulesSection(args: {
  resolvedPlan: HopyStateRegressionResolvedPlan;
  userInput: string;
}): string {
  if (!hasHopyExplicitBackwardSignal(args.userInput)) return "";

  const planSpecificRules =
    args.resolvedPlan === "pro"
      ? [
          "- Pro 利用中の相手に Free / Plus を自発的な代替案として差し込まないこと",
        ]
      : args.resolvedPlan === "plus"
        ? [
            "- Plus 利用中の相手に Free を主推奨として着地させないこと",
          ]
        : [
            "- Free でも共感だけで終わらず、シンプルな方向提示まで到達すること",
          ];

  return [
    "下降時の回答生成ルール:",
    "- 今回の入力には、再迷い・判断軸の揺らぎ・いったん定めた方向への不安の戻りが含まれる可能性があります。",
    "- このファイルで扱う下降ルールは補助であり、その回の確定 state は今回のユーザー入力と今回生成した最終返答の意味から決めること。",
    "- prev_phase / prev_state_level には入力前参考状態を入れ、current_phase / state_level には今回ターン後の確定状態を入れること。",
    "- 『決めたつもりだったがまた迷っている』『やっぱり自信がなくなった』『方向が揺らいだ』の意味なら、prev と current を同値固定しないこと。",
    "- そのような回は、再調整が必要になった下降候補として扱い、current_phase / state_level を下げる判断を許容すること。",
    "- 再迷い・再拡散・判断軸の揺らぎが意味上明確なら、state_changed=true を正として返してよいこと。",
    "- 下降回でも、本文は 理解 → 気づき → 方向 → なぜならば の順を基本に組み立てること。",
    "- 方向では広げ直しすぎず、再確認すべき判断軸や戻るべき基準を1本で示すこと。",
    "- Plus / Pro でその結果 state_changed=true なら Compass を必ず返すこと。",
    "- 下降Compassは、なぜ戻ったのかを説明する根拠として扱い、装飾にしないこと。",
    "- 最終 reply が、安心だけ・言い換えだけ・一般論だけで終わっていないか確認すること。",
    "- 必要な回では、HOPYとしての見立て、方向、理由が入っていること。",
    "- 低シグナル入力以外では、必ず『HOPYはこう考えます』に相当する見立てを本文に残すこと。",
    ...planSpecificRules,
  ].join("\n");
}

/*
【このファイルの正式役割】
HOPYの下降専用の状態依存 prompt section 群をまとめる専用ファイル。
再迷い・判断軸の揺らぎ・方向の後退・再調整など、下降方向の意味入力に応じて変化する prompt section 文言だけを担当する。
DB取得、DB保存、state_changed生成、Compass生成、○表示、messages取得、回答保存処理、最終組み立て順の決定は担当しない。

【今回このファイルで修正したこと】
- 下降シグナル最小判定用の hasHopyExplicitBackwardSignal(...) を追加した。
- buildHopyExplicitBackwardSignalSection(...) をこのファイル内へ持たせた。
- buildHopyRegressionTransitionSection(...) を追加した。
- buildHopyRegressionAnswerStructureSection(...) を追加した。
- buildHopyRegressionStateDensitySection(...) を追加した。
- buildHopyRegressionGenerationRulesSection(...) を追加した。
- 下降で state_changed=true になった Plus / Pro 回では Compass を必ず返す文言を、このファイルの責務内で明示した。
- 他ファイル、DB、UI、Compass表示処理、Future Chain保存処理には触れていない。

/app/api/chat/_lib/hopy/prompt/hopyStateRegressionDrivenPromptSections.ts
*/