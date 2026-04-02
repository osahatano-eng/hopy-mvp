// /app/api/chat/_lib/learning/extractPhraseObservations.ts

type PhraseObservationIntent =
  | "実行意思"
  | "不安"
  | "希望探索"
  | "諦めかけ"
  | "決意"
  | "回避"
  | "祈り"
  | "助けを求める気配"
  | "興味対象"
  | "不明";

type PhraseObservationTone =
  | "率直"
  | "静か"
  | "強め"
  | "ぼかし"
  | "自嘲"
  | "短文"
  | "断片的"
  | "不明";

export type ExtractedPhraseObservation = {
  rawText: string;
  normalizedText: string;
  language: string;
  detectedIntent: PhraseObservationIntent;
  detectedTone: PhraseObservationTone;
  estimatedStateLevel: 1 | 2 | 3 | 4 | 5;
  isNoise: boolean;
  isSensitive: boolean;
};

type ExtractPhraseObservationsParams = {
  userText: string;
  uiLang?: "ja" | "en" | string | null;
  estimatedStateLevel?: 1 | 2 | 3 | 4 | 5 | number | null;
};

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInnerSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function detectLanguage(userText: string, uiLang?: string | null): string {
  const text = normalizeText(userText);

  if (/[ぁ-んァ-ヶ一-龠]/.test(text)) return "ja";
  if (/[a-z]/i.test(text)) return "en";

  const ui = normalizeText(uiLang).toLowerCase();
  if (ui === "ja" || ui === "en") return ui;

  return "unknown";
}

function normalizeStateLevel(value?: number | null): 1 | 2 | 3 | 4 | 5 {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }
  return 1;
}

function isLikelyTopicInterestPhrase(normalizedText: string): boolean {
  const s = normalizeInnerSpaces(String(normalizedText ?? ""));
  if (!s) return false;
  if (s.length < 2 || s.length > 40) return false;

  if (/[?？!！。、,.]/.test(s)) return false;

  if (
    /助けて|支えて|聞いて|どうしたら|救って|大丈夫かな|不安|怖い|心配|迷う|迷い|揺れ|しんどい|苦しい|きつい|やる|やります|やってみる|進める|続ける|決めた|決断|逃げたい|避けたい|やりたくない|見たくない|触れたくない|祈る|願う|神頼み/.test(
      s,
    )
  ) {
    return false;
  }

  if (
    /\bhelp\b|\bafraid\b|\bworried\b|\btry\b|\bstart\b|\bdecided\b|\bavoid\b|\bpray\b/.test(
      s.toLowerCase(),
    )
  ) {
    return false;
  }

  return /^[ぁ-んァ-ヶ一-龠ーa-zA-Z0-9\s・&\-()（）]+$/.test(s);
}

function detectIntent(normalizedText: string): PhraseObservationIntent {
  const s = normalizedText.toLowerCase();

  if (!s) return "不明";

  if (
    /やる|やります|やってみる|進める|進みます|続ける|続けます|やっていく/.test(normalizedText) ||
    /\bi will\b|\bi'll\b|\bdo it\b|\btry\b|\bstart\b|\bkeep going\b/.test(s)
  ) {
    return "実行意思";
  }

  if (
    /大丈夫かな|不安|怖い|心配|迷う|迷い|揺れ|しんどい|苦しい|きつい/.test(normalizedText) ||
    /\banxious\b|\bworried\b|\bafraid\b|\bscared\b|\bunsure\b/.test(s)
  ) {
    return "不安";
  }

  if (
    /なんとかなるか|どうしよう|道筋|希望|可能性|探したい|探している|知りたい|購入方法|買い方|探し方|入手方法|どこで買える|どうやって買う/.test(normalizedText) ||
    /\bmaybe\b|\bperhaps\b|\bhope\b|\bpossible\b|\bhow\b|\bhow to\b|\bwhere to buy\b|\bhow can i get\b/.test(s)
  ) {
    return "希望探索";
  }

  if (
    /もういいかな|無理かも|諦め|だめかも|やめたい/.test(normalizedText) ||
    /\bgive up\b|\bquit\b|\bcan't\b|\bimpossible\b/.test(s)
  ) {
    return "諦めかけ";
  }

  if (
    /決めた|決めます|決断|腹をくくる|行くしかない/.test(normalizedText) ||
    /\bdecided\b|\bdecision\b|\bcommit\b|\bgo for it\b/.test(s)
  ) {
    return "決意";
  }

  if (
    /逃げたい|避けたい|やりたくない|見たくない|触れたくない/.test(normalizedText) ||
    /\bavoid\b|\brun away\b|\bnot want to\b/.test(s)
  ) {
    return "回避";
  }

  if (
    /祈る|お祈り|願う|神頼み/.test(normalizedText) ||
    /\bpray\b|\bwish\b/.test(s)
  ) {
    return "祈り";
  }

  if (
    /助けて|支えて|聞いて|どうしたら|救って/.test(normalizedText) ||
    /\bhelp me\b|\bplease help\b|\bcan you help\b/.test(s)
  ) {
    return "助けを求める気配";
  }

  if (
    /欲しい|ほしい|気になる|興味がある|好き|憧れ|憧れる|欲しくなった|手に入れたい|買いたい|欲しかった|探してる|探している/.test(normalizedText) ||
    /\binterested in\b|\blike\b|\blove\b|\bwant\b|\blooking for\b|\bdream of\b/.test(s)
  ) {
    return "興味対象";
  }

  if (isLikelyTopicInterestPhrase(normalizedText)) {
    return "興味対象";
  }

  return "不明";
}

function detectTone(rawText: string, normalizedText: string): PhraseObservationTone {
  const s = normalizedText.toLowerCase();

  if (!normalizedText) return "不明";
  if (normalizedText.length <= 8) return "短文";
  if (/^\S+$/.test(rawText.trim()) && rawText.trim().length <= 12) return "断片的";
  if (/かな|かも|気がする|ような|ちょっと|少し/.test(normalizedText) || /\bmaybe\b|\bkind of\b|\ba little\b/.test(s)) {
    return "ぼかし";
  }
  if (/もう無理|最悪|うざい|腹立つ|ふざけるな/.test(normalizedText) || /\bhate\b|\bawful\b|\bworst\b/.test(s)) {
    return "強め";
  }
  if (/笑|w\b|自分はだめ|情けない|惨め/.test(normalizedText) || /\blol\b|\bi'm pathetic\b/.test(s)) {
    return "自嘲";
  }
  if (/静か|そっと|ゆっくり|落ち着いて/.test(normalizedText)) {
    return "静か";
  }

  return "率直";
}

function detectNoise(normalizedText: string): boolean {
  if (!normalizedText) return true;

  if (/^[!?.,。、…\-\s]+$/.test(normalizedText)) return true;

  const lower = normalizedText.toLowerCase();
  return [
    "ok",
    "okay",
    "yes",
    "no",
    "thanks",
    "thank you",
    "hi",
    "hello",
    "うん",
    "はい",
    "いいえ",
    "ありがとう",
  ].includes(lower);
}

function detectSensitive(normalizedText: string): boolean {
  if (!normalizedText) return false;

  return (
    /住所|電話番号|メールアドレス|本名|クレジット|カード番号|マイナンバー|口座/.test(normalizedText) ||
    /\baddress\b|\bphone\b|\bemail\b|\bcredit card\b|\bcard number\b|\baccount number\b/.test(
      normalizedText.toLowerCase(),
    )
  );
}

export function extractPhraseObservations(
  params: ExtractPhraseObservationsParams,
): ExtractedPhraseObservation[] {
  const rawText = normalizeText(params.userText);
  const normalizedText = normalizeInnerSpaces(rawText);
  const language = detectLanguage(rawText, params.uiLang);
  const estimatedStateLevel = normalizeStateLevel(params.estimatedStateLevel);
  const isNoise = detectNoise(normalizedText);
  const isSensitive = detectSensitive(normalizedText);

  const observation: ExtractedPhraseObservation = {
    rawText,
    normalizedText,
    language,
    detectedIntent: detectIntent(normalizedText),
    detectedTone: detectTone(rawText, normalizedText),
    estimatedStateLevel,
    isNoise,
    isSensitive,
  };

  return [observation];
}