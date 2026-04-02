// lib/hopyMood.ts
export type MoodMode = "stabilize" | "ignite";

const JA_NEG = [
  "つらい","辛い","不安","怖い","こわい","疲れた","しんどい","無理","もうだめ","だめ",
  "やばい","泣","泣き","死にたい","消えたい","苦しい","孤独","寂しい","さみしい",
  "イライラ","むかつく","最悪","失敗","後悔","どうせ","できない","病ん","うつ","鬱",
  "不眠","眠れない","焦り","焦る","落ち込","絶望","無価値","意味ない","やめたい"
];

const JA_POS = [
  "ワクワク","嬉しい","うれしい","楽しい","たのしい","最高","いける","できる","やれる",
  "頑張る","がんばる","挑戦","成長","前向き","希望","やりたい","やってみる","やる",
  "楽しみ","興奮","いい感じ","うまくいった","達成","成功","進む","進める","自信"
];

const EN_NEG = [
  "tired","anxious","anxiety","scared","afraid","stressed","stress","depressed","depression",
  "sad","lonely","angry","upset","hopeless","burnout","can't","cannot","won't","failure",
  "regret","panic","insomnia","overwhelmed"
];

const EN_POS = [
  "excited","happy","fun","great","awesome","let's go","i can","can do","motivated","motivation",
  "challenge","growth","hope","confident","confidence","achieved","success","progress","try",
  "looking forward","hyped"
];

function countHits(text: string, list: string[]) {
  const t = text.toLowerCase();
  let n = 0;
  for (const w of list) {
    if (w.length >= 2 && t.includes(w.toLowerCase())) n++;
  }
  return n;
}

export function calcMood(text: string): { mode: MoodMode; score: number; pos: number; neg: number } {
  const t = String(text ?? "").trim();
  const neg = countHits(t, JA_NEG) + countHits(t, EN_NEG);
  const pos = countHits(t, JA_POS) + countHits(t, EN_POS);

  // score: + でポジ寄り、- でネガ寄り
  const score = pos - neg;

  // ルール：ネガ要素が明確にあるなら stabilize を優先
  const mode: MoodMode = neg > 0 && pos <= neg ? "stabilize" : "ignite";

  return { mode, score, pos, neg };
}

// モードに応じた“温度”の違いを system 指示に落とす
export function buildModeSystemPrompt(mode: MoodMode, lang: "ja" | "en") {
  if (lang === "en") {
    return mode === "stabilize"
      ? [
          "You are HOPY AI. Use a calm, gentle tone.",
          "Goal: stabilize emotions first, then offer one tiny next step.",
          "Do NOT push hard. Ask at most one soft question.",
          "Reflect feelings, summarize simply, and validate without exaggeration."
        ].join("\n")
      : [
          "You are HOPY AI. Use an uplifting, energizing tone (not loud).",
          "Goal: amplify positive momentum and propose a small exciting next step.",
          "Keep it practical. Celebrate progress and connect to future vision.",
          "Ask one motivating question if helpful."
        ].join("\n");
  }

  // ja
  return mode === "stabilize"
    ? [
        "あなたはHOPY AI。口調は優しく静かに。",
        "最優先：心の安定（安心）→その後にごく小さな次の一歩。",
        "追い込まない。質問は最大1つ、やわらかく。",
        "感情の言語化→短い要約→安心材料の提示。誇張はしない。"
      ].join("\n")
    : [
        "あなたはHOPY AI。温度は少し高め、前向きに（うるさくしない）。",
        "最優先：ワクワクを増幅→小さく具体的な次の一歩。",
        "過去の前進を称え、未来のイメージにつなげる。",
        "必要なら背中を押す質問を1つ。"
      ].join("\n");
}
