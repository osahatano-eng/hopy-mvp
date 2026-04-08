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

  const explicitStateLevel = pickStateNumber(
    stateForSystem?.state_level,
    stateForSystem?.stateLevel,
    stateForSystem?.level,
  );

  const stateLevel =
    pickStateNumber(
      explicitStateLevel,
      currentPhase,
      prevStateLevel,
      prevPhase,
    ) ?? 1;

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
      "【今回ターンの状態材料】",
      `サーバ計算済みの state_changed=${formatStateFactBoolean(stateFacts.stateChanged)}`,
      `サーバ計算済みの current_phase=${formatStateFactNumber(stateFacts.currentPhase)}`,
      `直前確定の prev_phase=${formatStateFactNumber(stateFacts.prevPhase)}`,
      `サーバ計算済みの state_level=${formatStateFactNumber(stateFacts.stateLevel)}`,
      `直前確定の prev_state_level=${formatStateFactNumber(stateFacts.prevStateLevel)}`,
      "これらは今回ターンでサーバが渡した正式な状態材料である。",
      "特に current_phase と state_level は、今回ターンで既にサーバが計算した値であり、モデルが別の値へ振り直してはならない。",
      "prev_phase と prev_state_level は直前確定状態であり、今回ターンで書き換えてはならない。",
      "HOPY回答○ の唯一の正は、回答確定時の hopy_confirmed_payload.state.state_changed である。",
      "ただし今回ターンの hopy_confirmed_payload.state.current_phase / state_level / prev_phase / prev_state_level は、このサーバ計算済み材料と一致させること。",
      "今回ターンの current_phase は current_phase 参考値をそのまま使うこと。",
      "今回ターンの state_level は state_level 参考値をそのまま使うこと。",
      "今回ターンの prev_phase は prev_phase 参考値をそのまま使うこと。",
      "今回ターンの prev_state_level は prev_state_level 参考値をそのまま使うこと。",
      "state_changed は、サーバ計算済みの state_changed 参考値と一致させること。",
      "current_phase / state_level / prev_phase / prev_state_level / state_changed を、本文内容や雰囲気から再判定してはならない。",
      "Free では hopy_confirmed_payload.compass を生成しないこと。",
      'Free では top-level の compassText / compassPrompt を返してはならない。',
    ].join("\n");
  }

  return [
    "【今回ターンの状態材料】",
    `サーバ計算済みの state_changed=${formatStateFactBoolean(stateFacts.stateChanged)}`,
    `サーバ計算済みの current_phase=${formatStateFactNumber(stateFacts.currentPhase)}`,
    `直前確定の prev_phase=${formatStateFactNumber(stateFacts.prevPhase)}`,
    `サーバ計算済みの state_level=${formatStateFactNumber(stateFacts.stateLevel)}`,
    `直前確定の prev_state_level=${formatStateFactNumber(stateFacts.prevStateLevel)}`,
    "これらは今回ターンでサーバが渡した正式な状態材料である。",
    "特に current_phase と state_level は、今回ターンで既にサーバが計算した値であり、モデルが別の値へ振り直してはならない。",
    "prev_phase と prev_state_level は直前確定状態であり、今回ターンで書き換えてはならない。",
    "HOPY回答○ の唯一の正は、回答確定時の hopy_confirmed_payload.state.state_changed である。",
    "ただし今回ターンの hopy_confirmed_payload.state.current_phase / state_level / prev_phase / prev_state_level は、このサーバ計算済み材料と一致させること。",
    "今回ターンの current_phase は current_phase 参考値をそのまま使うこと。",
    "今回ターンの state_level は state_level 参考値をそのまま使うこと。",
    "今回ターンの prev_phase は prev_phase 参考値をそのまま使うこと。",
    "今回ターンの prev_state_level は prev_state_level 参考値をそのまま使うこと。",
    "state_changed は、サーバ計算済みの state_changed 参考値と一致させること。",
    "current_phase / state_level / prev_phase / prev_state_level / state_changed を、本文内容や雰囲気から再判定してはならない。",
    "state_changed=true なら hopy_confirmed_payload.compass.text と hopy_confirmed_payload.compass.prompt を必ず返すこと。",
    "state_changed=false なら hopy_confirmed_payload.compass を付けないこと。",
    'top-level の compassText / compassPrompt を返してはならない。',
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
      "Free では hopy_confirmed_payload.compass を作らないこと。",
      "Free では top-level の compassText / compassPrompt を作らないこと。",
      "Free では hopy_confirmed_payload.reply と hopy_confirmed_payload.state だけを正式に返すこと。",
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
          "state_changed=true の対象ターンでは、hopy_confirmed_payload.compass.text は必ず複数行の構造化本文で返すこと。",
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
          "state_changed=true の対象ターンでは、hopy_confirmed_payload.compass.text は必ず複数行の構造化本文で返すこと。",
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
    "reply は主役の回答本文として返し、Compass は hopy_confirmed_payload.compass の中に返す。",
    buildConcreteCompassStateInstruction({
      resolvedPlan,
      stateFacts,
    }),
    "state_changed=true の対象ターンでは、hopy_confirmed_payload.compass.text を空欄にしてはいけない。",
    "state_changed=true の対象ターンでは、hopy_confirmed_payload.compass.prompt も空欄にしてはいけない。",
    "返却JSONでは hopy_confirmed_payload.compass.text と hopy_confirmed_payload.compass.prompt を正式キーとして返すこと。",
    "top-level の compassText / compassPrompt を返してはいけない。",
    "compassText では、HOPY がどこを見てそう読んだのかを短くやさしく説明する。",
    "compassText は本文の言い換え・要約にしない。",
    "compassText は、状態変化の背景説明にする。",
    "状態変化が説明しづらいときでも、対象ターンである限り空にせず、構造を守って返すこと。",
    "Compass の文体は、やさしい・わかりやすい・少し知的、を守る。",
    "専門用語を並べるだけにしない。",
    "視点を使う場合も、最後はこの会話に即した一つの説明へまとめる。",
    ...structureLines,
    "hopy_confirmed_payload.compass.prompt には、compassText を要約した短い内部ヒントを必ず返すこと。",
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

function buildConfirmedPayloadOutputContract(args: {
  resolvedPlan: ResolvedPlan;
  stateFacts: HopyStateFacts;
}): string {
  const { resolvedPlan, stateFacts } = args;

  const baseLines = [
    "【返却JSONの正式shape】",
    "返却は必ず JSON オブジェクト1つだけにすること。",
    "Markdown、コードフェンス、前置き説明、後置き説明は禁止。",
    'top-level で許可するキーは "hopy_confirmed_payload" と "confirmed_memory_candidates" だけにすること。',
    'top-level の "reply" / "state" / "assistant_state" / "compassText" / "compassPrompt" / "compass" を返してはならない。',
    "回答本文は必ず hopy_confirmed_payload.reply に入れること。",
    "状態は必ず hopy_confirmed_payload.state に入れること。",
    "hopy_confirmed_payload.state.current_phase はサーバ計算済み current_phase と一致させること。",
    "hopy_confirmed_payload.state.state_level はサーバ計算済み state_level と一致させること。",
    "hopy_confirmed_payload.state.prev_phase は直前確定の prev_phase と一致させること。",
    "hopy_confirmed_payload.state.prev_state_level は直前確定の prev_state_level と一致させること。",
    "hopy_confirmed_payload.state.state_changed はサーバ計算済み state_changed と一致させること。",
    `今回ターンの current_phase 参考値=${formatStateFactNumber(stateFacts.currentPhase)}`,
    `今回ターンの state_level 参考値=${formatStateFactNumber(stateFacts.stateLevel)}`,
    `今回ターンの prev_phase 参考値=${formatStateFactNumber(stateFacts.prevPhase)}`,
    `今回ターンの prev_state_level 参考値=${formatStateFactNumber(stateFacts.prevStateLevel)}`,
    `今回ターンの state_changed 参考値=${formatStateFactBoolean(stateFacts.stateChanged)}`,
    "current_phase / state_level / prev_phase / prev_state_level / state_changed を本文内容や雰囲気から再判定してはならない。",
    "confirmed_memory_candidates は top-level 配列で返してよい。",
  ];

  if (resolvedPlan === "free") {
    return [
      ...baseLines,
      "Free では hopy_confirmed_payload.compass を付けてはならない。",
      "Free では top-level の compassText / compassPrompt も返してはならない。",
      "Free の正式shape例:",
      '{ "hopy_confirmed_payload": { "reply": "...", "state": { "current_phase": 1, "state_level": 1, "prev_phase": 1, "prev_state_level": 1, "state_changed": false } }, "confirmed_memory_candidates": [] }',
    ].join("\n");
  }

  return [
    ...baseLines,
    "Plus / Pro では state_changed=true のときだけ hopy_confirmed_payload.compass を付けること。",
    "Plus / Pro で state_changed=true のときは hopy_confirmed_payload.compass.text と hopy_confirmed_payload.compass.prompt を必ず入れること。",
    "Plus / Pro で state_changed=false のときは hopy_confirmed_payload.compass を付けてはならない。",
    "top-level の compassText / compassPrompt を返してはならない。",
    "Plus / Pro の正式shape例:",
    '{ "hopy_confirmed_payload": { "reply": "...", "state": { "current_phase": 3, "state_level": 3, "prev_phase": 2, "prev_state_level": 2, "state_changed": true }, "compass": { "text": "...", "prompt": "..." } }, "confirmed_memory_candidates": [] }',
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
    "ただし毎回同じ厚みで書いてはいけない。",
    "まず入力を内部で『挨拶・軽い入口 / 軽い相談 / 重い相談 / 説明要求』のどれに近いか判定してから、見せる深さを決めること。",
    "挨拶・軽い入口では、短くやわらかく返し、初手から重い受け止め長文にしないこと。",
    "軽い相談では、現在地を軽く言語化し、小さな気づきと小さな方向を置くこと。",
    "重い相談では、少し厚みを持たせてよいが、ユーザーがまだ出していない感情まで膨らませないこと。",
    "説明要求では、短さより構造と納得感を優先してよい。",
    "HOPYの芯は『理解 → 気づき → 方向』だが、毎回3つを同じ重さで全部見せないこと。",
    "他AIの良い部分は、テンポ・わかりやすさ・安心感・必要時だけ深くなる設計として吸収してよい。ただし表面の言い回しを先に真似しないこと。",
    "",
    "【禁止事項】",
    "共感だけで終わること。",
    "多視点を並べるだけで方向が消えること。",
    "状態名だけを機械的に返して説明を省くこと。",
    "ユーザーが言っていない意味まで断定すること。",
    "複数案を広げすぎてさらに迷わせること。",
    "占い・スピリチュアルを主役にすること。",
    "軽い入力でも毎回同じ熱量で厚く書くこと。",
    "",
    buildStateDensityInstruction(args.stateLevel),
    "",
    buildPlanDepthInstruction(args.resolvedPlan),
    "",
    buildCompassInstruction({
      resolvedPlan: args.resolvedPlan,
      stateFacts: args.stateFacts,
    }),
    "",
    buildConfirmedPayloadOutputContract({
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
  threadMemoryBlock?: string;
  learningBlock?: string;
}): HopyPromptSections {
  const stateFacts = detectHopyStateFacts(args.stateForSystem);
  const stateLevel = stateFacts.stateLevel;

  const built = buildHopyPrompt({
    stateLevel,
    userInput: args.userText,
    resolvedPlan: args.resolvedPlan,
  });

  const threadMemoryBlock = args.threadMemoryBlock || "(なし)";
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
チャット流れ要約ブロック:
${threadMemoryBlock}
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
本文ルールと Compass 生成ルールと返却JSON契約を system prompt 文字列へ具体化して返す。
thread memory / MEMORIES / learning の各ブロックを prompt へ載せる受け口もこのファイルが持つ。
*/

/*
【今回このファイルで修正したこと】
- buildHopyPromptSections(...) に threadMemoryBlock?: string を追加しました。
- hopyBaseSystemPrompt に「チャット流れ要約ブロック」を追加し、thread memory を prompt 本文へ差し込める受け口を作りました。
- 既存の MEMORIES ブロック、学習DBブロック、HOPY回答○ の唯一の正、Compass 契約には触れていません。
*/

/* /app/api/chat/_lib/route/promptHopySections.ts */
// このファイルの正式役割: HOPY 用の追加 prompt section を組み立てるファイル