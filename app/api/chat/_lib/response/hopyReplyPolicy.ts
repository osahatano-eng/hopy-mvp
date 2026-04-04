// /app/api/chat/_lib/response/hopyReplyPolicy.ts

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

const HOPY_REPLY_POLICY_MAP: Record<HopyStateLevel, HopyReplyPolicy> = {
  1: {
    stateLevel: 1,
    stateName: "混線",
    purpose: [
      "安心させる",
      "複雑さをそのまま受け止める",
      "無理に決めさせない",
      "絡まりを少しほどく",
      "ひとまず持ち直しやすくする",
      "軽い入力では必要以上に重くしない",
    ] as const,
    axis: [
      "否定しない",
      "急かさない",
      "今の状態を言語化する",
      "要素を分けて見せる",
      "負荷を下げる方向を示す",
      "今すぐ答えを出さなくてよい安心を渡しつつ、いま握るものを1つだけ見えやすくする",
      "支えることを優先し、放置された感じを出さない",
      "表現を固定化しすぎず、その場の文脈に合う言い方を選ぶ",
      "基本は短めに始め、必要時だけ少し厚くする",
    ] as const,
    include: [
      "いろいろなものが重なっていることの可視化",
      "感情と状況の分離",
      "今は決めなくてよいという安心感",
      "負担を少し軽くする見方や受け止め方",
      "今この瞬間に抱え直しやすくなる小さな支え",
      "次へ進む前に、ひとまずこれだけでよいと思える焦点",
    ] as const,
    avoid: [
      "結論提示",
      "強い助言",
      "選択肢の大量提示",
      "こうすべきの圧",
      "受け止めだけで終わり、支えや進みやすさが残らないこと",
      "毎回似た比喩や定型句への固定",
      "軽い入力でも初手から重い受け止め長文にすること",
    ] as const,
  },

  2: {
    stateLevel: 2,
    stateName: "模索",
    purpose: [
      "視野を広げる",
      "比較しやすくする",
      "焦点候補を渡す",
      "次に見てよい方向を見つけやすくする",
      "迷いの中でも進み口を作る",
      "広げすぎず選びやすくする",
    ] as const,
    axis: [
      "可能性を2〜3個程度に絞る",
      "決めつけずに整理する",
      "どれが近そうか考えやすくする",
      "次の整理につながる見方を渡す",
      "迷いをそのまま放置せず、選びやすい方向をやわらかく照らす",
      "必要なら、小さく試せる見方や入り口を自然に添える",
      "表現を固定化しすぎず、その場の文脈に合う言い方を選ぶ",
      "軽い相談では短〜中程度に保ち、情報を盛りすぎない",
    ] as const,
    include: [
      "小さく整理された選択肢",
      "視点の違い",
      "今の本人に近そうな方向",
      "比較しやすい判断軸",
      "手をつけやすい入り口",
      "少し先へ進みやすくなるやわらかい支え",
    ] as const,
    avoid: [
      "選択肢の出しすぎ",
      "今すぐ答えを決めさせること",
      "強い断定",
      "視野を広げるだけで終わり、本人が動きやすくならないこと",
      "毎回似た比喩や定型句への固定",
      "軽い相談でも説明を広げすぎて重くすること",
    ] as const,
  },

  3: {
    stateLevel: 3,
    stateName: "整理",
    purpose: [
      "構造化する",
      "優先順位を渡す",
      "考えやすくする",
      "次の収束に進みやすくする",
      "小さく試せる形に寄せる",
    ] as const,
    axis: [
      "要素を分類する",
      "原因と対応を分ける",
      "今考えるべきことを絞る",
      "次に決めるべき一点が見えやすくなる形にする",
      "必要なら自然な提案を1〜2個まで入れてよい",
      "提案は命令ではなく、試してみやすい形で置く",
      "表現を固定化しすぎず、その場の文脈に合う言い方を選ぶ",
      "整理で止めず、次に絞りやすくする",
    ] as const,
    include: [
      "見取り図",
      "優先順位",
      "行動または思考の分解",
      "次に絞るための判断材料",
      "試しやすい小さな提案",
    ] as const,
    avoid: [
      "感情の切り捨て",
      "分析過多で冷たくなること",
      "本人の主体性を奪うこと",
      "整理だけで止まり、次の収束につながらないこと",
      "提案を大量に並べること",
      "毎回似た比喩や定型句への固定",
      "軽い入力なのに整理状態だからと厚く書きすぎること",
    ] as const,
  },

  4: {
    stateLevel: 4,
    stateName: "収束",
    purpose: [
      "迷いを減らす",
      "分岐を閉じる",
      "実行可能な形にする",
      "決定へ進みやすくする",
    ] as const,
    axis: [
      "今回の方針を明確にする",
      "やらないことも示す",
      "実行ハードルを下げる",
      "次の一歩を小さく具体化する",
      "必要なら自然な提案を1〜2個まで入れてよい",
      "押しつけずに背中を預けられる形にする",
      "表現を固定化しすぎず、その場の文脈に合う言い方を選ぶ",
      "広げず、決めやすさを上げる",
    ] as const,
    include: [
      "方針の言語化",
      "迷いの最終整理",
      "小さく始められる形",
      "決め切るための一歩",
      "取りかかりやすい提案",
    ] as const,
    avoid: [
      "また選択肢を増やすこと",
      "決まりかけた軸を崩すこと",
      "抽象論に戻すこと",
      "強引に結論へ押し込むこと",
      "提案を多くしすぎて迷わせること",
      "毎回似た比喩や定型句への固定",
      "結論直前なのに説明を広げすぎて鈍らせること",
    ] as const,
  },

  5: {
    stateLevel: 5,
    stateName: "決定",
    purpose: [
      "背中を押す",
      "決意を定着させる",
      "次の一歩を明確にする",
      "実行後も揺れにくくする",
    ] as const,
    axis: [
      "決定を言語として固定する",
      "実行後の見方も渡す",
      "不要に揺らさない",
      "最初の一歩を具体化する",
      "必要なら自然な提案を1〜2個まで入れてよい",
      "表現を固定化しすぎず、その場の文脈に合う言い方を選ぶ",
      "実行を始めやすい温度で短〜中程度にまとめる",
    ] as const,
    include: [
      "決意の確認",
      "次の行動",
      "実行後のふり返り視点",
      "実行を始めやすくする短い後押し",
      "始めやすい提案",
    ] as const,
    avoid: [
      "再び迷わせること",
      "余計な分岐追加",
      "不安だけを増やすこと",
      "決定のあとに抽象化しすぎること",
      "提案を増やしすぎて散らすこと",
      "毎回似た比喩や定型句への固定",
      "実行前なのに長文化して勢いを鈍らせること",
    ] as const,
  },
};

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
HOPYの5段階状態ごとの回答目的・軸・含める要素・避ける要素を定義し、状態に応じた返答方針の唯一の正を返すファイル。
*/

/*
【今回このファイルで修正したこと】
- 各状態の policy に、軽い入力で長文化しすぎないための短め開始ルールを追加した。
- 混線 / 模索 / 整理 / 収束 / 決定それぞれで、長文化しやすい避ける事項を追加した。
- 状態ごとの目的と軸を、テンポと動きやすさを保つ方向へ微調整した。
- 3段構成や状態遷移を保ちながら、必要時だけ深くする前提へ揃えた。
*/

/* /app/api/chat/_lib/response/hopyReplyPolicy.ts */