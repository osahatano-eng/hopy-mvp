// /app/api/chat/_lib/hopy/prompt/hopyInputSignalResolver.ts

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isHopyLowSignalInput(userInput: string): boolean {
  const normalized = normalizeText(userInput).toLowerCase();

  if (!normalized) return true;

  const compact = normalized.replace(/\s+/g, "");

  const meaningfulShortPatterns = new Set([
    "もう無理",
    "もうむり",
    "無理",
    "むり",
    "もうだめ",
    "もうダメ",
    "だめ",
    "ダメ",
    "だめです",
    "ダメです",
    "つらい",
    "辛い",
    "しんどい",
    "苦しい",
    "怖い",
    "こわい",
    "助けて",
    "たすけて",
    "疲れた",
    "つかれた",
    "限界",
    "詰んだ",
    "不安",
    "困った",
    "迷う",
    "迷ってる",
    "直らない",
    "不具合",
    "泣きたい",
    "消えたい",
    "死にたい",
  ]);

  for (const pattern of meaningfulShortPatterns) {
    if (compact.includes(pattern)) {
      return false;
    }
  }

  const shortPatterns = new Set([
    "こんにちは",
    "こんばんは",
    "おはよう",
    "やあ",
    "hi",
    "hello",
    "hey",
    "いいね",
    "ありがとう",
    "最高",
    "助かる",
    "なるほど",
    "了解",
    "たのしみ",
    "がんばる",
    "嬉しい",
    "うれしい",
    "よかった",
    "おはよ",
  ]);

  if (shortPatterns.has(compact)) return true;
  if (compact.length <= 8) return true;

  return false;
}

export function hasHopyExplicitForwardCommitment(userInput: string): boolean {
  const normalized = normalizeText(userInput);
  if (!normalized) return false;

  const patterns = [
    "進めていきます",
    "進めます",
    "進めてみます",
    "進めていく",
    "始めます",
    "やります",
    "やってみます",
    "やっていきます",
    "取り組みます",
    "続けます",
    "実行します",
    "この方針でいきます",
    "この方向でいきます",
    "この形でいきます",
    "このやり方でいきます",
    "まずは",
    "ここから",
    "やることにしました",
    "決めました",
    "自己修正から",
    "自己修正で",
    "整理していきます",
    "絞っていきます",
  ];

  return patterns.some((pattern) => normalized.includes(pattern));
}

/*
【このファイルの正式役割】
HOPYの入力文から、低シグナル入口入力かどうか、前進表明が含まれるかどうかを判定する入力シグナル判定専用ファイル。
prompt文言の組み立て、DB取得、DB保存、state_changed生成、Compass生成、○表示、messages取得、回答保存処理は担当しない。

【今回このファイルで修正したこと】
- hopyPromptSections.ts に混在していた入力シグナル判定責務の受け皿として新規作成した。
- isHopyLowSignalInput(...) をこのファイルへ切り出した。
- hasHopyExplicitForwardCommitment(...) をこのファイルへ切り出した。
- この2関数が依存する normalizeText(...) を、このファイル内のローカル関数として持たせた。
- 他のprompt section文言、JSON契約、HOPY唯一の正、Compass条件、DBやUIには触れていない。

/app/api/chat/_lib/hopy/prompt/hopyInputSignalResolver.ts
*/