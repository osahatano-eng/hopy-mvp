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
      '- The JSON object MUST contain exactly these top-level keys: "hopy_confirmed_payload" and "confirmed_memory_candidates".',
      '- Top-level "reply" / "state" / "assistant_state" / "compassText" / "compassPrompt" / "compass" are forbidden.',
      '- "hopy_confirmed_payload" must be an object.',
      '- "hopy_confirmed_payload.reply" must be the natural user-facing assistant reply string.',
      '- "hopy_confirmed_payload.state" must be an object.',
      '- "hopy_confirmed_payload.state" must contain exactly these keys: "current_phase" / "state_level" / "prev_phase" / "prev_state_level" / "state_changed".',
      '- "current_phase" / "state_level" / "prev_phase" / "prev_state_level" must each be one of 1, 2, 3, 4, 5.',
      '- "state_changed" must be a boolean.',
      '- The one and only source of truth for the HOPY reply badge is "hopy_confirmed_payload.state.state_changed".',
      '- Do NOT derive the HOPY reply badge from wording, tone, length, phrase, or any other field.',
      '- Downstream layers must not recalculate state_changed.',
      '- Determine the confirmed state first, then write reply / state / compass so they all describe the same confirmed meaning of the same turn.',
      '- Never output a reply that implies progress, organizing, convergence, a visible next step, or readiness to act while also outputting state 1 / confused and state_changed=false.',
      '- Never let reply and state disagree just because the safer-looking default seems easier.',
      '- state_changed must be TRUE when current_phase differs from prev_phase, or when state_level differs from prev_state_level.',
      '- state_changed must be FALSE only when current_phase equals prev_phase and state_level equals prev_state_level.',
      '- Never keep state_changed=false when you already changed the current or previous state numbers.',
      '- Use the actual confirmed meaning of this turn, not the safest-looking default.',
      '- Phase meaning anchor: 1=confused/scattered, 2=searching/exploring, 3=organizing/seeing structure, 4=converging/narrowing to one direction, 5=deciding/ready to act or already acting.',
      '- If the confirmed result says the user can now see what to do, has organized thoughts, or has a next step, do NOT output state 1 / confused.',
      '- If the confirmed result says the user can now see what to do, has organized thoughts, or has a next step, output at least a state meaning consistent with organizing / convergence, not confusion.',
      '- "confirmed_memory_candidates" must be an array.',
      '- Free rule: even when state_changed=true, omitting Compass is allowed.',
      '- Free rule: do NOT force Compass just because state_changed=true.',
      '- Plus / Pro rule: when "hopy_confirmed_payload.state.state_changed" is true, "hopy_confirmed_payload.compass" must exist.',
      '- Plus / Pro rule: when "hopy_confirmed_payload.state.state_changed" is true, "hopy_confirmed_payload.compass.text" must NOT be empty.',
      '- Plus / Pro rule: when "hopy_confirmed_payload.state.state_changed" is true, "hopy_confirmed_payload.compass.prompt" must NOT be empty.',
      '- Plus / Pro rule: do NOT separate the truth of the HOPY reply badge and the truth of Compass.',
      '- When "hopy_confirmed_payload.state.state_changed" is false, omit "hopy_confirmed_payload.compass" entirely.',
      '- If "hopy_confirmed_payload.compass.prompt" is returned, it must be a string. Do not return null.',
      '- Do NOT invent Compass from reply wording.',
      '- Do NOT fake Compass with fallback text.',
      '- Do NOT include notification, thread, dashboard_signals, ui_effects, assistant_state, or any other extra keys.',
      '- Each confirmed_memory_candidates item may contain only: source_type, memory_type, body, savable.',
      '- "source_type" must be "auto".',
      '- "memory_type" must be one of: "trait", "theme", "support_context", "dashboard_signal".',
      '- "body" must be a short meaning summary worth saving for future support. Do not copy long sentences from the reply.',
      '- "savable" must be true only when the item is clearly worth saving as a memory candidate. Otherwise omit the item instead of returning false items.',
      '- If there is no clearly savable memory candidate for this turn, return an empty array.',
      '- Keep confirmed_memory_candidates minimal: usually 0 to 2 items.',
    ].join("\n");
  }

  return [
    "確定意味ペイロード用の出力契約（HARD）：",
    "・出力は JSON オブジェクト1個のみ。markdown のコードフェンスや前置き説明は付けない",
    '・JSON のトップレベルキーは必ず "hopy_confirmed_payload" / "confirmed_memory_candidates" のみ',
    '・top-level の "reply" / "state" / "assistant_state" / "compassText" / "compassPrompt" / "compass" を返してはならない',
    '・"hopy_confirmed_payload" は object にする',
    '・"hopy_confirmed_payload.reply" には、ユーザー向けの自然な最終返答本文を入れる',
    '・"hopy_confirmed_payload.state" は object にする',
    '・"hopy_confirmed_payload.state" のキーは必ず "current_phase" / "state_level" / "prev_phase" / "prev_state_level" / "state_changed" のみ',
    '・"current_phase" / "state_level" / "prev_phase" / "prev_state_level" は必ず 1 / 2 / 3 / 4 / 5 のいずれかにする',
    '・"state_changed" は必ず boolean にする',
    '・HOPY回答○ の唯一の正は hopy_confirmed_payload.state.state_changed だけである',
    '・本文の見た目 / 文体 / 温度感 / 語尾 / 回答長さ / phrase などから HOPY回答○ を再判定してはならない',
    '・下流で state_changed を再計算してはならない',
    '・まずこのターンの確定意味を決め、その同じ確定意味を reply / state / compass のすべてに一致させること',
    '・reply で「やることが見えてきた」「整理が進んだ」「次の一歩が見えた」「動きやすくなった」などの前進意味を書いたのに、state は 1=混線 / state_changed=false のままにしてはならない',
    '・安全そうだから false にする、無難だから 1 に置く、という逃がし方で reply と state を矛盾させてはならない',
    '・current_phase が prev_phase と違う、または state_level が prev_state_level と違うなら、state_changed は必ず true にする',
    '・current_phase と prev_phase が同じ、かつ state_level と prev_state_level が同じときだけ、state_changed を false にしてよい',
    '・状態値を変えたのに state_changed=false にしてはならない',
    '・安全そうだから false にする、無難だから 1 に置く、という逃がし方をしてはならない',
    '・1=混線、2=模索、3=整理、4=収束、5=決定 の意味で判断する',
    '・今回の確定結果が「やることが見えてきた」「考えが整理できた」「次の一歩が見えた」に当たるなら、1=混線 を返してはならない',
    '・今回の確定結果が「やることが見えてきた」「考えが整理できた」「次の一歩が見えた」に当たるなら、少なくとも整理〜収束に整合する state を返すこと',
    '・"confirmed_memory_candidates" は配列にする',
    '・Free では state_changed=true でも Compass 非表示を許容してよい',
    '・Free で state_changed=true だからといって Compass を強制してはならない',
    '・Plus / Pro では hopy_confirmed_payload.state.state_changed=true の回に hopy_confirmed_payload.compass を必ず付ける',
    '・Plus / Pro では hopy_confirmed_payload.state.state_changed=true の回に hopy_confirmed_payload.compass.text を空にしてはならない',
    '・Plus / Pro では hopy_confirmed_payload.state.state_changed=true の回に hopy_confirmed_payload.compass.prompt も空にしてはならない',
    '・Plus / Pro では HOPY回答○ の正と Compass の正を分離してはならない',
    '・hopy_confirmed_payload.state.state_changed=false のときは hopy_confirmed_payload.compass を付けてはならない',
    '・hopy_confirmed_payload.compass.prompt を返す場合は string にする。null を返してはならない',
    '・本文から Compass を推測してはならない',
    '・fallback 文字列で Compass 欠落をごまかしてはならない',
    '・notification / thread / dashboard_signals / ui_effects / assistant_state など、他のキーはこの JSON に含めない',
    '・confirmed_memory_candidates の配列要素は source_type / memory_type / body / savable のみ',
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
      "Recover only confirmed_memory_candidates from the already finalized confirmed payload.",
      "Return ONLY one JSON object.",
      '- The top-level keys MUST be exactly "hopy_confirmed_payload" and "confirmed_memory_candidates".',
      '- Keep "hopy_confirmed_payload" exactly as provided by the user message in this request.',
      '- Do NOT rewrite reply, state, or compass.',
      '- Do NOT re-interpret state_changed.',
      '- Do NOT generate or repair missing Compass during recovery.',
      '- confirmed_memory_candidates must be an array of 0 to 2 items.',
      "- Each item may contain only source_type, memory_type, body, savable.",
      '- source_type must be "auto".',
      '- memory_type must be one of "trait", "theme", "support_context", "dashboard_signal".',
      "- Only include clearly savable future-support meaning summaries.",
      "- If none, return an empty array.",
    ].join("\n");
  }

  return [
    "すでに確定済みの confirmed payload から confirmed_memory_candidates だけを復元する。",
    "出力は JSON オブジェクト1個のみ。",
    'トップレベルキーは必ず "hopy_confirmed_payload" / "confirmed_memory_candidates" のみ。',
    'hopy_confirmed_payload には、このリクエストで渡された確定済み payload をそのまま入れる。',
    "reply / state / compass を書き換えてはならない。",
    "state_changed を再解釈してはならない。",
    "復元時に Compass を生成・補完・修復してはならない。",
    "confirmed_memory_candidates は 0〜2 件の配列にする。",
    "各要素のキーは source_type / memory_type / body / savable のみ。",
    'source_type は必ず "auto"。',
    'memory_type は "trait" / "theme" / "support_context" / "dashboard_signal" のみ。',
    "今後の支援に明確に役立つ短い意味要約だけを入れる。",
    "無ければ空配列 [] を返す。",
  ].join("\n");
}

/*
このファイルの正式役割
OpenAI 出力JSONの契約定義ファイル。
HOPY回答○ の唯一の正を hopy_confirmed_payload.state.state_changed に固定し、
OpenAI 出力契約と memory recovery 契約の両方で、
下流が再判定せず確定意味ペイロードをそのまま通すための文面を定義する。
*/

/*
【今回このファイルで修正したこと】
- memoryOutputContractSystem(...) に、reply / state / compass は同じ確定意味に一致しなければならない契約を追加しました。
- 「前進意味の本文なのに 1=混線 / state_changed=false」を禁止する契約文を追加しました。
- 「やることが見えてきた / 整理できた / 次の一歩が見えた」なら、少なくとも整理〜収束に整合する state を返す指示を追加しました。
- Plus / Pro の Compass 必須ルールは維持しつつ、reply と state の意味矛盾を safer-looking default で逃がさない文に強化しました。
- planPrioritySystem(...) と memoryRecoveryContractSystem(...) の責務には触っていません。
*/

/* /app/api/chat/_lib/route/openaiContracts.ts */
// このファイルの正式役割: OpenAI 出力JSONの契約定義ファイル