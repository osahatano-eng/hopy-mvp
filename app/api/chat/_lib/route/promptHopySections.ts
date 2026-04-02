// /app/api/chat/_lib/route/promptHopySections.ts
import { buildHopyPrompt } from "../response/hopyPromptBuilder";
import type { ResolvedPlan } from "./promptProfile";

export type HopyPromptSections = {
  hopyCoreSystemPrompt: string;
  hopyBaseSystemPrompt: string;
  hopyUserPrompt: string;
};

type HopyStateFacts = {
  stateLevel: 1 | 2 | 3 | 4 | 5;
  currentPhase: 1 | 2 | 3 | 4 | 5 | null;
  prevPhase: 1 | 2 | 3 | 4 | 5 | null;
  prevStateLevel: 1 | 2 | 3 | 4 | 5 | null;
  stateChanged: boolean | null;
};

function pickStateNumber(
  ...values: unknown[]
): 1 | 2 | 3 | 4 | 5 | null {
  for (const value of values) {
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 5
    ) {
      return value as 1 | 2 | 3 | 4 | 5;
    }
  }

  return null;
}

function pickStateBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }

  return null;
}

function detectHopyStateFacts(stateForSystem: any): HopyStateFacts {
  const stateLevel =
    pickStateNumber(
      stateForSystem?.state_level,
      stateForSystem?.current_phase,
      stateForSystem?.stateLevel,
      stateForSystem?.currentPhase,
      stateForSystem?.phase,
      stateForSystem?.level,
    ) ?? 1;

  const currentPhase = pickStateNumber(
    stateForSystem?.current_phase,
    stateForSystem?.currentPhase,
    stateForSystem?.phase,
  );

  const prevPhase = pickStateNumber(
    stateForSystem?.prev_phase,
    stateForSystem?.prevPhase,
  );

  const prevStateLevel = pickStateNumber(
    stateForSystem?.prev_state_level,
    stateForSystem?.prevStateLevel,
  );

  const stateChanged = pickStateBoolean(
    stateForSystem?.state_changed,
    stateForSystem?.stateChanged,
  );

  return {
    stateLevel,
    currentPhase,
    prevPhase,
    prevStateLevel,
    stateChanged,
  };
}

function buildPlanDepthInstruction(resolvedPlan: ResolvedPlan): string {
  if (resolvedPlan === "pro") {
    return [
      "【プラン別本文深度: Pro】",
      "現在地は深く読解する。",
      "過去発言や継続する本音の兆しへの気づきを明確に返してよい。",
      "方向提示は本人専用に近い密度まで寄せてよい。",
      "必要時のみ、心理学・行動心理学・哲学・軽い意味づけの視点から2〜4視点まで補強してよい。",
      "ただし主役は常に、現在地・気づき・方向であり、多視点が主役になってはいけない。",
      "軽い占い・スピリチュアル要素は彩りとしてのみ許可し、未来断定・不安喚起・依存を生む表現は禁止する。",
    ].join("\n");
  }

  if (resolvedPlan === "plus") {
    return [
      "【プラン別本文深度: Plus】",
      "現在地はしっかり言語化する。",
      "直近の流れや継続テーマへの軽い気づきを返してよい。",
      "方向提示はFreeより本人向けに寄せてよい。",
      "必要時のみ、1〜2視点の軽い補強をしてよい。",
      "ただし深い過去発言の再接続や、多視点の厚い統合は行わない。",
      "軽い意味づけ・占い要素は必要時のみごく薄く添えてよいが、主役にしてはいけない。",
    ].join("\n");
  }

  return [
    "【プラン別本文深度: Free】",
    "その場の会話だけをもとに、現在地を軽く言語化する。",
    "その場の会話だけをもとに、基本的な気づきを返す。",
    "方向提示はシンプルかつ動ける単位まで落とす。",
    "深い継続記憶の前提、厚い多視点補強、濃い占い・スピリチュアル演出は行わない。",
    "Freeでも、共感だけで終わらず、必ず方向提示まで到達する。",
  ].join("\n");
}

function buildStateDensityInstruction(stateLevel: number): string {
  switch (stateLevel) {
    case 1:
      return [
        "【状態別本文密度: 混線】",
        "現在地の言語化はやや厚めにする。",
        "方向提示は必須かつやや強めにし、できるだけ一本に寄せる。",
        "慰めだけで終わらせず、「今は何を優先するか」を明確に返す。",
      ].join("\n");
    case 2:
      return [
        "【状態別本文密度: 模索】",
        "現在地と気づきは中程度で返す。",
        "方向提示は厚めにし、広げるより絞る力を持たせる。",
        "選択肢を増やしすぎず、今の流れに合う一本をできるだけ出す。",
      ].join("\n");
    case 3:
      return [
        "【状態別本文密度: 整理】",
        "現在地と気づきは中程度で返す。",
        "方向では、残すものと捨てるものが見えるようにする。",
        "必要以上に広げず、整理を前に進める形で返す。",
      ].join("\n");
    case 4:
      return [
        "【状態別本文密度: 収束】",
        "現在地と気づきは短〜中で返す。",
        "方向は中程度で、最後の絞り込みや実行準備を示す。",
        "余計に広げない。",
      ].join("\n");
    case 5:
      return [
        "【状態別本文密度: 決定】",
        "現在地と気づきは短めでよい。",
        "方向は厚めにし、実行・継続・次の確認行動へ落とす。",
        "決める段階を越えている場合は、実行を後押しする。",
      ].join("\n");
    default:
      return [
        "【状態別本文密度】",
        "現在地・気づき・方向の3段構成を守る。",
        "方向提示を消さない。",
      ].join("\n");
  }
}

function formatStateFactNumber(value: 1 | 2 | 3 | 4 | 5 | null): string {
  return value == null ? "null" : String(value);
}

function formatStateFactBoolean(value: boolean | null): string {
  return value == null ? "null" : value ? "true" : "false";
}

function buildConcreteCompassStateInstruction(args: {
  resolvedPlan: ResolvedPlan;
  stateFacts: HopyStateFacts;
}): string {
  const { resolvedPlan, stateFacts } = args;

  if (resolvedPlan === "free") {
    return [
      "【今回ターンのCompass判定材料】",
      `今回の state_changed=${formatStateFactBoolean(stateFacts.stateChanged)}`,
      `今回の current_phase=${formatStateFactNumber(stateFacts.currentPhase)}`,
      `今回の prev_phase=${formatStateFactNumber(stateFacts.prevPhase)}`,
      `今回の state_level=${formatStateFactNumber(stateFacts.stateLevel)}`,
      `今回の prev_state_level=${formatStateFactNumber(stateFacts.prevStateLevel)}`,
      "この具体値を今回ターンの正として扱うこと。",
      "Free では Compass は生成しないこと。",
      'Free では compassText と compassPrompt を必ず空文字 "" にすること。',
    ].join("\n");
  }

  return [
    "【今回ターンのCompass判定材料】",
    `今回の state_changed=${formatStateFactBoolean(stateFacts.stateChanged)}`,
    `今回の current_phase=${formatStateFactNumber(stateFacts.currentPhase)}`,
    `今回の prev_phase=${formatStateFactNumber(stateFacts.prevPhase)}`,
    `今回の state_level=${formatStateFactNumber(stateFacts.stateLevel)}`,
    `今回の prev_state_level=${formatStateFactNumber(stateFacts.prevStateLevel)}`,
    "この具体値を今回ターンの正として扱うこと。",
    "抽象ルールではなく、この値に従って compassText / compassPrompt を判断すること。",
    "state_changed=true のときだけ Compass 対象ターンとして扱うこと。",
    "state_changed=true なら compassText と compassPrompt を必ず返すこと。",
    "state_changed=false なら Compass 非対象ターンとして扱い、compassText と compassPrompt は必ず空文字にすること。",
  ].join("\n");
}

function buildCompassInstruction(args: {
  resolvedPlan: ResolvedPlan;
  stateFacts: HopyStateFacts;
}): string {
  const { resolvedPlan, stateFacts } = args;

  if (resolvedPlan === "free") {
    return [
      "【Compass生成ルール】",
      "Free では Compass を生成しないこと。",
      "reply は主役の回答本文として返すこと。",
      buildConcreteCompassStateInstruction({
        resolvedPlan,
        stateFacts,
      }),
      "Free では compassText を作らないこと。",
      "Free では compassPrompt を作らないこと。",
      '返却時は compassText と compassPrompt を必ず空文字 "" にすること。',
      "compass.text のような別構造だけで返してはいけない。",
    ].join("\n");
  }

  const planDepthLine =
    resolvedPlan === "pro"
      ? "Pro では2〜3視点まで使ってよいが、主役はあくまで根拠説明であり、学問披露にしない。"
      : "Plus では1〜2視点までの軽い補強にとどめ、短く読みやすく返す。";

  const structureLines =
    resolvedPlan === "pro"
      ? [
          "state_changed=true の対象ターンでは、compassText は必ず複数行の構造化本文で返すこと。",
          "1文だけの短文にしてはいけない。",
          "見出しは必ず次の正式名を使うこと。",
          "【いまの状態】",
          "【学問的解釈】",
          "【占い的解釈】",
          "【あなたへ】",
          "【創業者より、あなたへ】",
          "【学問的解釈】ではテーマに応じた複数学問を用い、各行を「学問名：本文」の形式で書くこと。",
          "【占い的解釈】では必ず「過去：」「現在：」「未来：」の3行を書くこと。",
          "【あなたへ】と【創業者より、あなたへ】には、それぞれ少なくとも1行以上の本文を書くこと。",
        ]
      : [
          "state_changed=true の対象ターンでは、compassText は必ず複数行の構造化本文で返すこと。",
          "1文だけの短文にしてはいけない。",
          "見出しは必ず次の正式名を使うこと。",
          "【いまの状態】",
          "【学問的解釈】",
          "【あなたへ】",
          "【占い的解釈】は出さないこと。",
          "【創業者より、あなたへ】は出さないこと。",
          "【学問的解釈】ではテーマに応じた複数学問を用い、各行を「学問名：本文」の形式で書くこと。",
          "【あなたへ】には、少なくとも1行以上の本文を書くこと。",
        ];

  return [
    "【Compass生成ルール】",
    "Compass は本文の別回答ではない。",
    "Compass は、なぜこの回答に○が付いたのか、なぜ状態がここに確定したのかを根拠説明する補助レイヤーである。",
    "reply は主役の回答本文として返し、compassText は本文とは別に返す。",
    buildConcreteCompassStateInstruction({
      resolvedPlan,
      stateFacts,
    }),
    "state_changed=true の対象ターンでは、compassText を空欄にしてはいけない。",
    "state_changed=true の対象ターンでは、compassPrompt も空欄にしてはいけない。",
    "返却JSONでは compassText と compassPrompt を正式キーとして返すこと。",
    "compass.text だけを返してはいけない。",
    "compassText では、HOPY がどこを見てそう読んだのかを短くやさしく説明する。",
    "compassText は本文の言い換え・要約にしない。",
    "compassText は、状態変化の背景説明にする。",
    "状態変化が説明しづらいときでも、対象ターンである限り空にせず、構造を守って返すこと。",
    "Compass の文体は、やさしい・わかりやすい・少し知的、を守る。",
    "専門用語を並べるだけにしない。",
    "視点を使う場合も、最後はこの会話に即した一つの説明へまとめる。",
    ...structureLines,
    "compassPrompt には、compassText を要約した短い内部ヒントを必ず返すこと。",
    "Compass で扱ってよい中心内容は次の通り。",
    "・ユーザーの言葉のどこに変化の兆しがあったか",
    "・迷いから絞り込みへ進んだ理由",
    "・気持ちではなく行動の焦点が定まった理由",
    "・現実ではどういう進み方として起きやすいか",
    planDepthLine,
    "Compass では次をしてはいけない。",
    "・本文と同じ助言を繰り返すこと",
    "・学問名を並べるだけで終わること",
    "・説教や評価にすること",
    "・state_changed がない前提の一般論を書くこと",
  ].join("\n");
}

function buildHopyAnswerContract(args: {
  resolvedPlan: ResolvedPlan;
  stateLevel: number;
  stateFacts: HopyStateFacts;
}): string {
  return [
    "【HOPY回答の中核骨格】",
    "HOPY回答は、以下の3段構成を中核骨格として必ず守ること。",
    "1. 現在地: ユーザーがいまどの状態かを落ち着いて言語化する。",
    "2. 気づき: ユーザーの言葉の中にある本音・繰り返し・惹かれ・違和感への気づきを返す。",
    "3. 方向: その人の流れに合った次の一歩を、できるだけ一本で示す。",
    "",
    "【本文構造ルール】",
    "第1〜第3ブロックが本体であり、方向ブロックを消してはいけない。",
    "多視点補強は必要時のみ補助として使ってよいが、主役にしてはいけない。",
    "本文の価値は長さではなく、安心 → 納得 → 行動につながる流れにある。",
    "",
    "【禁止事項】",
    "共感だけで終わること。",
    "多視点を並べるだけで方向が消えること。",
    "状態名だけを機械的に返して説明を省くこと。",
    "ユーザーが言っていない意味まで断定すること。",
    "複数案を広げすぎてさらに迷わせること。",
    "占い・スピリチュアルを主役にすること。",
    "",
    buildStateDensityInstruction(args.stateLevel),
    "",
    buildPlanDepthInstruction(args.resolvedPlan),
    "",
    buildCompassInstruction({
      resolvedPlan: args.resolvedPlan,
      stateFacts: args.stateFacts,
    }),
  ].join("\n");
}

export function buildHopyPromptSections(args: {
  resolvedPlan: ResolvedPlan;
  stateForSystem: any;
  userText: string;
  memoryBlock: string;
  learningBlock?: string;
}): HopyPromptSections {
  const stateFacts = detectHopyStateFacts(args.stateForSystem);
  const stateLevel = stateFacts.stateLevel;

  const built = buildHopyPrompt({
    stateLevel,
    userInput: args.userText,
    resolvedPlan: args.resolvedPlan,
  });

  const memoryBlock = args.memoryBlock || "(なし)";
  const learningBlock = args.learningBlock || "(なし)";
  const answerContract = buildHopyAnswerContract({
    resolvedPlan: args.resolvedPlan,
    stateLevel,
    stateFacts,
  });

  return {
    hopyCoreSystemPrompt: built.systemPrompt,
    hopyBaseSystemPrompt: `${built.developerPrompt}
${answerContract}
既存MEMORIESブロック:
${memoryBlock}
学習DBブロック:
${learningBlock}`,
    hopyUserPrompt: built.userPrompt,
  };
}

/*
このファイルの正式役割
HOPY 用の追加 prompt section を組み立てるファイル。
stateForSystem から今回ターンの状態材料を受け取り、
本文ルールと Compass 生成ルールを system prompt 文字列へ具体化して返す。
*/

/*
【今回このファイルで修正したこと】
- ファイル末尾で重複していた「このファイルの正式役割」コメントを1つに整理しました。
- ロジック本体、stateFacts 抽出、Compass 条件、HOPY prompt section 組み立ては触っていません。
*/