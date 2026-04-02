// /app/api/chat/_lib/route/openaiContracts.ts
import type { Lang } from "../router/simpleRouter";

type ResolvedPlanLike = "free" | "plus" | "pro";

export function planPrioritySystem(args: {
  uiLang: Lang;
  resolvedPlan: ResolvedPlanLike;
}): string {
  const { uiLang, resolvedPlan } = args;

  if (uiLang === "en") {
    if (resolvedPlan === "pro") {
      return [
        "Plan enforcement priority (HARD):",
        "- The active plan for this reply is Pro.",
        "- The user is already on Pro right now. Answer from that current-plan premise.",
        "- Do NOT recommend Free as the default fit when the active plan is Pro.",
        "- Do NOT frame the answer as if the user is choosing from scratch unless the user explicitly asks to compare from zero.",
        "- First explain why Pro exists and what Pro uniquely gives: deepest continuity, strongest memory-aware support, and long-range personalized support.",
        "- The answer must feel clearly Pro, not Free-like.",
        "- Prefer deeper continuity, stronger tailoring, and thicker long-range support when the user's message benefits from it.",
        "- If the user asks what plan fits them while they are already on Pro, the default direction is to affirm Pro's fit before mentioning lower plans.",
        "- Only mention Free or Plus as lighter alternatives, not as the main recommendation, unless the user explicitly asks to downgrade, reduce cost, or keep things minimal.",
        "- If the user is comparing plans, do NOT conclude in a way that centers Free as the best fit by default.",
        "- For long-term or continuity-oriented needs, Pro should read as the strongest fit.",
      ].join("\n");
    }

    if (resolvedPlan === "plus") {
      return [
        "Plan enforcement priority (HARD):",
        "- The active plan for this reply is Plus.",
        "- The user is already on Plus right now. Answer from that current-plan premise.",
        "- Do NOT recommend Free as the default fit when the active plan is Plus.",
        "- First explain why Plus exists and what Plus uniquely gives: continuity across conversations and support that carries forward prior context.",
        "- The answer must feel clearly Plus, not Free-like.",
        "- Prefer continuity-aware support and slightly fuller follow-up than Free.",
        "- If the user asks what plan fits them while they are already on Plus, the default direction is to affirm Plus's fit before mentioning other plans.",
        "- Only mention Free as a lighter alternative, not as the main recommendation, unless the user explicitly asks to downgrade, reduce cost, or keep things minimal.",
        "- When the user's need clearly points to deeper long-range continuity, stronger personalized support, or the strongest memory-aware support, it is allowed to present Pro as the more suitable higher option.",
        "- In ongoing-support contexts, Plus should read as a strong current fit, while Pro may naturally read as the higher fit when the user's need is clearly deeper than Plus territory.",
      ].join("\n");
    }

    return [
      "Plan enforcement priority (HARD):",
      "- The active plan for this reply is Free.",
      "- The user is currently on Free right now. Answer from that current-plan premise.",
      "- Keep the answer light, simple, and in-the-moment.",
      "- Do NOT describe Free as the safest final choice in a way that makes Plus or Pro sound worse.",
      "- If the user asks about longer-term support, leave room for Plus or Pro to sound more suitable for continuity.",
    ].join("\n");
  }

  if (resolvedPlan === "pro") {
    return [
      "プラン優先制御（HARD）：",
      "・この回答の現行プランは Pro である",
      "・ユーザーは今すでに Pro を利用中である。この現在地を前提に答える",
      "・Pro 利用中の相手に対して、Free を既定の最適解として勧めてはいけない",
      "・ユーザーが明示的に最初から比較しているのでない限り、未加入前提の説明に戻さない",
      "・まず Pro が存在する理由と、Pro 固有の価値を先に述べる。内容は『最も深い継続理解』『最も強い記憶反映』『長期でずっと寄り添いやすい支援』を中心にする",
      "・返答は Free っぽくならず、明確に Pro の厚みを感じる内容にする",
      "・必要に応じて、より深い継続理解、強い個別化、長期支援の厚みを優先する",
      "・ユーザーが『自分に合うプラン』を聞いたとき、現時点で Pro 利用中なら、基本は Pro が合う理由を先に伝える",
      "・Free / Plus は『より軽い代替』として触れるのはよいが、主推奨にしてはいけない。例外は、ユーザーが節約・縮小・ダウングレードを明示したときだけ",
      "・プラン比較時に、Free を既定の最適解として着地させない",
      "・長期利用や継続支援の文脈では、Pro が最も合う選択肢として自然に読める返答にする",
      "・『ただし』『ですが』『もし〜ならFree』のような逆接で、文末や後半から下位プランへ逃がさない",
      "・Free / Plus の名前を出さなくても、『軽く使いたい』『記憶を残さず使いたい』のような逃がし方を文末に置かない",
    ].join("\n");
  }

  if (resolvedPlan === "plus") {
    return [
      "プラン優先制御（HARD）：",
      "・この回答の現行プランは Plus である",
      "・ユーザーは今すでに Plus を利用中である。この現在地を前提に答える",
      "・Plus 利用中の相手に対して、Free を既定の最適解として勧めてはいけない",
      "・まず Plus が存在する理由と、Plus 固有の価値を先に述べる。内容は『会話をまたいだ継続性』『前提を引き継いだ寄り添い』を中心にする",
      "・返答は Free っぽくならず、明確に Plus の継続性を感じる内容にする",
      "・前提を引き継いだ寄り添いと、Free より一段厚い支援を優先する",
      "・ユーザーが『自分に合うプラン』を聞いたとき、現時点で Plus 利用中なら、基本は Plus が合う理由を先に伝える",
      "・Free は『より軽い代替』として触れるのはよいが、主推奨にしてはいけない。例外は、ユーザーが節約・縮小・ダウングレードを明示したときだけ",
      "・より深い継続理解、より強い個別化、より長期の支援厚みが明確に必要な文脈では、Pro を Plus より上位の自然な候補として出してよい",
      "・継続利用の文脈では、Plus は強い現行適合として読める返答にする。一方で、要求が明確に Plus を超える深さなら、Pro の方がより合うと自然に読める返答にする",
      "・『ただし』『ですが』『もし〜ならFree』のような逆接で、文末や後半から Free へ逃がさない",
      "・Free の名前を出さなくても、『軽く使いたい』『記憶を残さず使いたい』のような逃がし方を文末に置かない",
    ].join("\n");
  }

  return [
    "プラン優先制御（HARD）：",
    "・この回答の現行プランは Free である",
    "・ユーザーは今すでに Free を利用中である。この現在地を前提に答える",
    "・返答は軽く、その場で使いやすい方向に保つ",
    "・ただし Free だけが最適解のようには見せない",
    "・継続支援や長期利用の文脈では、Plus / Pro の方が合う余地を残す",
  ].join("\n");
}

export function memoryOutputContractSystem(uiLang: Lang): string {
  if (uiLang === "en") {
    return [
      "Output format contract for confirmed meaning payload (HARD):",
      "- Return ONLY a single JSON object. No markdown fences. No commentary outside JSON.",
      '- The JSON object MUST contain exactly these top-level keys: "reply", "state", "confirmed_memory_candidates", "compassText", and "compassPrompt".',
      '- "reply" must be a natural user-facing assistant reply string.',
      '- "state" must be an object.',
      '- "state" must contain exactly these keys: "current_phase", "state_level", "prev_phase", "prev_state_level", and "state_changed".',
      '- "current_phase", "state_level", "prev_phase", and "prev_state_level" must each be one of 1, 2, 3, 4, 5.',
      '- "state_changed" must be a boolean.',
      '- "confirmed_memory_candidates" must be an array.',
      '- "compassText" and "compassPrompt" are official top-level keys. Do not replace them with nested-only keys such as compass.text.',
      '- Do not include hopy_confirmed_payload, assistant_state, notification, thread, dashboard_signals, ui_effects, or any other extra keys.',
      '- Free rule: "compassText" must be an empty string and "compassPrompt" must be an empty string.',
      '- State-change rule: only when state_changed=true may Compass be generated.',
      '- State-change rule: when state_changed=false, "compassText" must be an empty string and "compassPrompt" must be an empty string even on Plus or Pro.',
      '- Plus rule: when state_changed=true, "compassText" must NOT be empty. It must be a structured multi-line display body using exactly these headings: 【いまの状態】, 【学問的解釈】, 【あなたへ】. Do not include 【占い的解釈】 or 【創業者より、あなたへ】.',
      '- Pro rule: when state_changed=true, "compassText" must NOT be empty. It must be a structured multi-line display body using exactly these headings: 【いまの状態】, 【学問的解釈】, 【占い的解釈】, 【あなたへ】, 【創業者より、あなたへ】.',
      '- For Plus or Pro with state_changed=true, do NOT leave "compassText" empty.',
      '- For Plus or Pro with state_changed=true, do NOT leave "compassPrompt" empty.',
      '- "compassPrompt" must be a short internal Compass generation hint string.',
      '- Each array item must be an object with these keys only: source_type, memory_type, body, savable.',
      '- "source_type" must be "auto".',
      '- "memory_type" must be one of: "trait", "theme", "support_context", "dashboard_signal".',
      '- "body" must be a short meaning summary worth saving for future support. Do not copy long sentences from the reply.',
      '- "savable" must be true only when the item is clearly worth saving as a memory candidate. Otherwise omit the item instead of returning false items.',
      "- If there is no clearly savable memory candidate for this turn, return an empty array.",
      "- Keep confirmed_memory_candidates minimal: usually 0 to 2 items.",
    ].join("\n");
  }

  return [
    "確定意味ペイロード用の出力契約（HARD）：",
    "・出力は JSON オブジェクト1個のみ。markdown のコードフェンスや前置き説明は付けない",
    '・JSON のトップレベルキーは必ず "reply" / "state" / "confirmed_memory_candidates" / "compassText" / "compassPrompt" のみ',
    '・"reply" には、ユーザー向けの自然な最終返答本文を入れる',
    '・"state" は object にする',
    '・"state" のキーは必ず "current_phase" / "state_level" / "prev_phase" / "prev_state_level" / "state_changed" のみ',
    '・"current_phase" / "state_level" / "prev_phase" / "prev_state_level" は必ず 1 / 2 / 3 / 4 / 5 のいずれかにする',
    '・"state_changed" は必ず boolean にする',
    '・"confirmed_memory_candidates" は配列にする',
    '・"compassText" と "compassPrompt" は Compass の正式トップレベルキーである。compass.text のような別構造だけで返してはいけない',
    '・hopy_confirmed_payload / assistant_state / notification / thread / dashboard_signals / ui_effects など、他のキーはこの JSON に含めない',
    '・Free では "compassText" も "compassPrompt" も必ず空文字 "" を返す',
    '・Compass は state_changed=true のときだけ生成してよい',
    '・state_changed=false のときは、Plus / Pro でも "compassText" と "compassPrompt" を必ず空文字 "" にする',
    '・Plus では、state_changed=true の回答では "compassText" を空文字にしてはいけない。必ず複数行の構造化本文を返し、見出しは【いまの状態】【学問的解釈】【あなたへ】の3つを正式名で使う。【占い的解釈】【創業者より、あなたへ】は出さない',
    '・Pro では、state_changed=true の回答では "compassText" を空文字にしてはいけない。必ず複数行の構造化本文を返し、見出しは【いまの状態】【学問的解釈】【占い的解釈】【あなたへ】【創業者より、あなたへ】を正式名で使う',
    '・Plus / Pro の state_changed=true ターンでは "compassText" を必ず返す',
    '・Plus / Pro の state_changed=true ターンでは "compassPrompt" も必ず返す',
    '・"compassPrompt" には Compass 用の短い内部ヒント文字列を入れる',
    "・配列要素は object とし、キーは source_type / memory_type / body / savable のみ",
    '・"source_type" は必ず "auto"',
    '・"memory_type" は "trait" / "theme" / "support_context" / "dashboard_signal" のいずれかのみ',
    '・"body" は、今後の支援に使う価値がある短い意味要約にする。reply本文の長い言い換えやコピペはしない',
    '・"savable" は明確に保存価値がある候補だけ true にする。保存価値が弱いものは false を返さず、配列に入れない',
    "・このターンで明確な候補がなければ、空配列 [] を返す",
    "・confirmed_memory_candidates は最小限。通常は 0〜2 件に抑える",
  ].join("\n");
}

export function memoryRecoveryContractSystem(uiLang: Lang): string {
  if (uiLang === "en") {
    return [
      "Recover confirmed memory candidates from the already written assistant reply.",
      "Return ONLY one JSON object.",
      'Top-level keys MUST be exactly "reply", "state", "confirmed_memory_candidates", "compassText", and "compassPrompt".',
      'Keep "reply" exactly as provided by the user message in this request.',
      '"state" must be kept exactly as provided by the user message in this request.',
      'confirmed_memory_candidates must be an array of 0 to 2 items.',
      'compassText must be kept as provided if present, otherwise return an empty string.',
      'compassPrompt must be kept as provided if present, otherwise return an empty string.',
      "Each item may contain only source_type, memory_type, body, savable.",
      'source_type must be "auto".',
      'memory_type must be one of "trait", "theme", "support_context", "dashboard_signal".',
      "Only include clearly savable future-support meaning summaries.",
      "If none, return an empty array.",
    ].join("\n");
  }

  return [
    "すでに生成済みの assistant reply から confirmed_memory_candidates だけを復元する。",
    "出力は JSON オブジェクト1個のみ。",
    'トップレベルキーは必ず "reply" / "state" / "confirmed_memory_candidates" / "compassText" / "compassPrompt" のみ。',
    'reply には、このリクエストで渡された assistant reply をそのまま入れる。',
    'state には、このリクエストで渡された state をそのまま入れる。',
    "confirmed_memory_candidates は 0〜2 件の配列にする。",
    'compassText は既に与えられていればそれを保ち、無ければ空文字 "" を返す。',
    'compassPrompt は既に与えられていればそれを保ち、無ければ空文字 "" を返す。',
    "各要素のキーは source_type / memory_type / body / savable のみ。",
    'source_type は必ず "auto"。',
    'memory_type は "trait" / "theme" / "support_context" / "dashboard_signal" のみ。',
    "今後の支援に明確に役立つ短い意味要約だけを入れる。",
    "無ければ空配列 [] を返す。",
  ].join("\n");
}

/*
【今回このファイルで修正したこと】
- OpenAI 出力契約のトップレベル必須キーに state を追加した。
- state を要求する実装と、state を禁止する契約文の矛盾を解消した。
- Plus / Pro の state_changed=true ターンでは compassText だけでなく compassPrompt も必須に固定した。
- 余計な追加キーを禁止し、reply / state / confirmed_memory_candidates / compassText / compassPrompt の正式shapeに固定した。

このファイルの正式役割
OpenAI 出力JSONの契約定義ファイル
*/