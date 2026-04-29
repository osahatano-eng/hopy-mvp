// /app/api/chat/_lib/hopy/prompt/hopyOpenAIJsonContractPrompt.ts
import type { Lang } from "../../router/simpleRouter";
import type { ResolvedPlanLike } from "../../route/openaiPlan";

function normalizeResolvedPlan(value: ResolvedPlanLike): string {
  return String(value ?? "").trim().toLowerCase();
}

function buildFutureChainContractLines(args: { uiLang: Lang }): string[] {
  if (args.uiLang === "ja") {
    return [
      "Future Chain v3.1 境界ルール:",
      "この OpenAI JSON 契約では、future_chain_context を返してはならない。",
      "Future Chain v3.1 の future_chain_context / handoff_message_snapshot は、回答確定後の専用処理で作る。",
      "OpenAI JSON内で owner_handoff / recipient_support / recipient_support_query / handoff_message_snapshot を生成してはならない。",
      "future_chain_context を top-level に返してはならない。",
      "hopy_confirmed_payload の内側にも future_chain_context を置いてはならない。",
      "Future Chain の長い4項目、handoff本文、未来ユーザー向け文言を、このJSON契約で生成してはならない。",
      "HOPY回答本文、Compass全文、ユーザー発話生文、個人情報、企業機密を Future Chain 用JSONとして作ってはならない。",
    ];
  }

  return [
    "Future Chain v3.1 boundary rule:",
    "Do not return future_chain_context in this OpenAI JSON contract.",
    "Future Chain v3.1 future_chain_context and handoff_message_snapshot are created by the post-confirmation dedicated flow.",
    "Do not generate owner_handoff, recipient_support, recipient_support_query, or handoff_message_snapshot inside the OpenAI JSON.",
    "Never return future_chain_context at the top level.",
    'Never include future_chain_context inside "hopy_confirmed_payload" either.',
    "Do not generate long Future Chain fields, handoff text, or future-user-facing text in this JSON contract.",
    "Do not create Future Chain JSON from the full HOPY reply, full Compass text, raw user text, personal information, or company secrets.",
  ];
}

export function buildStateStructureSystem(args: { uiLang: Lang }): string {
  if (args.uiLang === "ja") {
    return [
      "最重要出力ルール:",
      "返答は JSON object 1個だけで返すこと。",
      "markdown・コードブロック・説明文は禁止。",
      'トップレベルキーは "hopy_confirmed_payload" / "confirmed_memory_candidates" のみとすること。',
      "top-level の reply / state / assistant_state / compassText / compassPrompt / compass / future_chain_context は返してはならない。",
      '"hopy_confirmed_payload" は必須。',
      '"hopy_confirmed_payload.reply" は 1文字以上必須。',
      '"hopy_confirmed_payload.state" は必須。',
      "hopy_confirmed_payload.state.current_phase / state_level / prev_phase / prev_state_level は 1|2|3|4|5 の整数必須。",
      "0..4 は禁止。",
      "hopy_confirmed_payload.state.state_changed は boolean 必須。",
      "state_changed は shape の飾りではない。",
      "state_changed は、その回に HOPY が確定した状態変化の正をそのまま返すこと。",
      "state_changed を false に固定したり、無難だから false にしたりしてはならない。",
      "下の JSON は出力形を守るための構造例であり、state の数値や boolean は固定値ではない。",
      "この例の current_phase / state_level / prev_phase / prev_state_level / state_changed は、今回ターンの意味で必ず決め直すこと。",
      '"confirmed_memory_candidates" は必須で、配列にすること。',
      ...buildFutureChainContractLines({ uiLang: args.uiLang }),
      "正式JSON構造例:",
      "{",
      '  "hopy_confirmed_payload": {',
      '    "reply": "HOPYの本文",',
      '    "state": {',
      '      "current_phase": 3,',
      '      "state_level": 3,',
      '      "prev_phase": 2,',
      '      "prev_state_level": 2,',
      '      "state_changed": true',
      "    }",
      "  },",
      '  "confirmed_memory_candidates": []',
      "}",
      "重要: 上の 3 / 2 / true は固定コピー禁止。今回ターンに合わない場合は必ず変更すること。",
      "重要: Future Chain v3.1 の handoff_message_snapshot は、このJSONで生成せず、回答確定後の専用処理で作る。",
    ].join("\n");
  }

  return [
    "Most important output rule:",
    "Return exactly one JSON object.",
    "Do not output markdown, code fences, or explanations.",
    'The top-level keys must be only "hopy_confirmed_payload" and "confirmed_memory_candidates".',
    "Never return top-level reply, state, assistant_state, compassText, compassPrompt, compass, or future_chain_context.",
    '"hopy_confirmed_payload" is required.',
    '"hopy_confirmed_payload.reply" must be a non-empty string.',
    '"hopy_confirmed_payload.state" is required.',
    "hopy_confirmed_payload.state.current_phase, state_level, prev_phase, and prev_state_level must be integers in 1|2|3|4|5.",
    "Never use 0..4.",
    "hopy_confirmed_payload.state.state_changed must be a boolean.",
    "state_changed is not decorative shape data.",
    "state_changed must reflect HOPY's confirmed transition truth for this turn.",
    "Do not default state_changed to false just because it looks safer.",
    "The JSON below is a structure example for valid output. The state numbers and boolean are not fixed values.",
    "You must decide current_phase, state_level, prev_phase, prev_state_level, and state_changed from this turn's meaning.",
    '"confirmed_memory_candidates" is required and must be an array.',
    ...buildFutureChainContractLines({ uiLang: args.uiLang }),
    "Official JSON structure example:",
    "{",
    '  "hopy_confirmed_payload": {',
    '    "reply": "main reply",',
    '    "state": {',
    '      "current_phase": 3,',
    '      "state_level": 3,',
    '      "prev_phase": 2,',
    '      "prev_state_level": 2,',
    '      "state_changed": true',
    "    }",
    "  },",
    '  "confirmed_memory_candidates": []',
    "}",
    "Important: the 3 / 2 / true values must not be copied blindly. Change them whenever they do not match this turn.",
    "Important: Future Chain v3.1 handoff_message_snapshot must not be generated as JSON here; it is created by the post-confirmation dedicated flow.",
  ].join("\n");
}

export function buildStateMeaningSystem(args: { uiLang: Lang }): string {
  if (args.uiLang === "ja") {
    return [
      "状態確定ルール:",
      "hopy_confirmed_payload.state は、この回のユーザー入力と、この回に自分が確定した最終返答の意味から決めること。",
      "prev_phase / prev_state_level は入力前の参考状態である。",
      "current_phase / state_level は今回ターン後の確定状態である。",
      "入力前状態をそのまま current に持ち込んではならない。",
      "current と prev の意味が異なるなら state_changed=true にすること。",
      "current と prev の意味が同じときだけ state_changed=false にしてよい。",
      "HOPYが候補から一つを提案しただけでは、ユーザーの状態が整理へ確定したとは限らない。",
      "ユーザーがまだ『どれを選ぶべきか』をHOPYに委ねている場合は、候補があっても混線または模索のままでよい。",
      "ユーザー自身が『これに決めました』『この順番で進めます』『理由はこうです』のように選択・理由・採用を明示した場合は、整理または収束へ進みやすい。",
      "『整理できた』『やることが見えてきた』『次の一歩が見えた』『方向が定まった』など前進意味なのに、固定値コピーで逃げてはならない。",
      "下流は再判定しないため、このターンで自分が確定した真値をそのまま返すこと。",
    ].join("\n");
  }

  return [
    "State decision rule:",
    "Decide hopy_confirmed_payload.state from the meaning of this turn's user input and this turn's final reply that you have confirmed.",
    "prev_phase and prev_state_level are the reference state before this turn.",
    "current_phase and state_level are the confirmed state after this turn.",
    "Do not carry the pre-turn state into current unchanged by default.",
    "If current and prev differ in meaning, set state_changed=true.",
    "Set state_changed=false only when current and prev truly mean the same state.",
    "When HOPY merely chooses one option for the user, the user's state is not necessarily confirmed as organized.",
    "If the user is still asking HOPY to choose what to pick, the state may remain mixed or exploring even when options exist.",
    'If the user explicitly says something like "I decided", "I will proceed in this order", or gives their own reason for adopting an option, the state is more likely to move into organized or converging.',
    'Do not escape with fixed copied values when the turn clearly means progress such as "things became clearer", "the next step became visible", or "direction was found".',
    "Downstream will not re-judge this, so return the truth you confirmed in this turn.",
  ].join("\n");
}

export function buildCompassStructureSystem(args: {
  uiLang: Lang;
  resolvedPlan: ResolvedPlanLike;
}): string {
  const plan = normalizeResolvedPlan(args.resolvedPlan);

  if (plan === "free") {
    if (args.uiLang === "ja") {
      return [
        "Compassルール:",
        "Free では Compass を出してはならない。",
        "state_changed=true でも hopy_confirmed_payload.compass を付けてはならない。",
        "Compass をトップレベルへ置いてはならない。",
        "reply と state は必ず hopy_confirmed_payload 内に返すこと。",
      ].join("\n");
    }

    return [
      "Compass rule:",
      "Do not output Compass on Free.",
      'Even when state_changed=true, do not include "hopy_confirmed_payload.compass".',
      "Never place Compass at the top level.",
      'Always return reply and state inside "hopy_confirmed_payload".',
    ].join("\n");
  }

  if (args.uiLang === "ja") {
    return [
      "Compassルール:",
      "Plus / Pro では HOPY回答○ と Compass を分離してはならない。",
      "hopy_confirmed_payload.state.state_changed=false のときは hopy_confirmed_payload.compass を付けてはならない。",
      "hopy_confirmed_payload.state.state_changed=true のときは hopy_confirmed_payload.compass を必ず付けること。",
      "その場合、hopy_confirmed_payload.compass.text は必ず非空で返すこと。",
      "その場合、hopy_confirmed_payload.compass.prompt も必ず非空で返すこと。",
      "Compass をトップレベルへ置いてはならない。",
      "本文から Compass を推測したり、fallback 文字列でごまかしたりしてはならない。",
      'reply と state を "hopy_confirmed_payload" の外へ出してはならない。',
    ].join("\n");
  }

  return [
    "Compass rule:",
    "On Plus / Pro, never separate the HOPY reply badge truth and Compass truth.",
    'When "hopy_confirmed_payload.state.state_changed" is false, omit "hopy_confirmed_payload.compass" entirely.',
    'When "hopy_confirmed_payload.state.state_changed" is true, you must include "hopy_confirmed_payload.compass".',
    '"hopy_confirmed_payload.compass.text" must be non-empty in that case.',
    '"hopy_confirmed_payload.compass.prompt" must also be non-empty in that case.',
    "Never place Compass at the top level.",
    "Do not infer Compass from reply wording, and do not fake it with fallback text.",
    'Never place reply or state outside "hopy_confirmed_payload".',
  ].join("\n");
}

export function buildEmptyJsonRetrySystem(args: { uiLang: Lang }): string {
  if (args.uiLang === "ja") {
    return [
      "再出力指示:",
      "直前の出力は空でした。",
      "今回は空文字を返してはいけません。",
      "必ず JSON object 1個だけを非空で返してください。",
      '最小でも "hopy_confirmed_payload" / "confirmed_memory_candidates" を含めてください。',
      '"hopy_confirmed_payload.reply" は 1文字以上必須です。',
      '"hopy_confirmed_payload.state" は必須です。',
      '"confirmed_memory_candidates" は空配列でもよいので必ず返してください。',
      "top-level の reply / state / compassText / compassPrompt / future_chain_context は禁止です。",
      "hopy_confirmed_payload.future_chain_context も返してはなりません。",
      "state_changed を false に固定して逃げてはいけません。",
      "JSON object の外に説明文を出してはいけません。",
      ...buildFutureChainContractLines({ uiLang: args.uiLang }),
    ].join("\n");
  }

  return [
    "Retry instruction:",
    "The previous output was empty.",
    "Do not return an empty string this time.",
    "Return exactly one non-empty JSON object.",
    'At minimum include "hopy_confirmed_payload" and "confirmed_memory_candidates".',
    '"hopy_confirmed_payload.reply" must contain at least 1 character.',
    '"hopy_confirmed_payload.state" is required.',
    '"confirmed_memory_candidates" may be empty but must be present.',
    "Top-level reply, state, compassText, compassPrompt, and future_chain_context are forbidden.",
    'Do not return "hopy_confirmed_payload.future_chain_context" either.',
    "Do not escape by defaulting state_changed to false.",
    "Do not output any explanation outside the JSON object.",
    ...buildFutureChainContractLines({ uiLang: args.uiLang }),
  ].join("\n");
}

export function buildContractRetrySystem(args: { uiLang: Lang }): string {
  if (args.uiLang === "ja") {
    return [
      "再出力指示:",
      "直前の JSON は HOPY の正式契約に違反していました。",
      "今回は hopy_confirmed_payload 正式shape を厳守してください。",
      "トップレベルキーは hopy_confirmed_payload / confirmed_memory_candidates のみです。",
      "top-level の reply / state / assistant_state / compassText / compassPrompt / compass / future_chain_context は禁止です。",
      "hopy_confirmed_payload.future_chain_context も返してはなりません。",
      "hopy_confirmed_payload.state.current_phase / state_level / prev_phase / prev_state_level は 1|2|3|4|5 の整数必須です。",
      "hopy_confirmed_payload.state.state_changed は boolean 必須です。",
      "state_changed を false に固定してはなりません。",
      "Free では hopy_confirmed_payload.compass を付けてはなりません。",
      "Plus / Pro では state_changed=true の回に hopy_confirmed_payload.compass.text を必ず非空で返してください。",
      "Plus / Pro では state_changed=true の回に hopy_confirmed_payload.compass.prompt も必ず非空で返してください。",
      "空文字や省略や fallback でごまかしてはいけません。",
      "Future Chain v3.1 の handoff_message_snapshot は、このJSONで生成せず、回答確定後の専用処理で作ります。",
      "必ず JSON object 1個だけを返してください。",
      "JSON object の外に説明文を出してはいけません。",
      ...buildFutureChainContractLines({ uiLang: args.uiLang }),
      "正式JSON構造例:",
      "{",
      '  "hopy_confirmed_payload": {',
      '    "reply": "HOPYの本文",',
      '    "state": {',
      '      "current_phase": 3,',
      '      "state_level": 3,',
      '      "prev_phase": 2,',
      '      "prev_state_level": 2,',
      '      "state_changed": true',
      "    }",
      "  },",
      '  "confirmed_memory_candidates": []',
      "}",
      "重要: 上の 3 / 2 / true は固定コピー禁止。今回ターンに合わない場合は必ず変更すること。",
    ].join("\n");
  }

  return [
    "Retry instruction:",
    "The previous JSON violated the HOPY contract.",
    "Return the official hopy_confirmed_payload shape exactly this time.",
    'The top-level keys must be only "hopy_confirmed_payload" and "confirmed_memory_candidates".',
    "Top-level reply, state, assistant_state, compassText, compassPrompt, compass, and future_chain_context are forbidden.",
    'Do not return "hopy_confirmed_payload.future_chain_context" either.',
    "hopy_confirmed_payload.state.current_phase, state_level, prev_phase, and prev_state_level must be integers in 1|2|3|4|5.",
    "hopy_confirmed_payload.state.state_changed must be a boolean.",
    "Do not hard-code state_changed to false.",
    'On Free, do not return "hopy_confirmed_payload.compass".',
    'On Plus / Pro, when state_changed=true, "hopy_confirmed_payload.compass.text" must be non-empty.',
    'On Plus / Pro, when state_changed=true, "hopy_confirmed_payload.compass.prompt" must also be non-empty.',
    "Do not fake compliance with empty strings, omissions, or fallback text.",
    "Future Chain v3.1 handoff_message_snapshot must not be generated as JSON here; it is created by the post-confirmation dedicated flow.",
    "Return exactly one JSON object.",
    "Do not output any explanation outside the JSON object.",
    ...buildFutureChainContractLines({ uiLang: args.uiLang }),
    "Official JSON structure example:",
    "{",
    '  "hopy_confirmed_payload": {',
    '    "reply": "main reply",',
    '    "state": {',
    '      "current_phase": 3,',
    '      "state_level": 3,',
    '      "prev_phase": 2,',
    '      "prev_state_level": 2,',
    '      "state_changed": true',
    "    }",
    "  },",
    '  "confirmed_memory_candidates": []',
    "}",
    "Important: the 3 / 2 / true values must not be copied blindly. Change them whenever they do not match this turn.",
  ].join("\n");
}

/*
【このファイルの正式役割】
OpenAI 実行層で使う HOPY JSON 契約プロンプト文言を生成するファイル。
hopy_confirmed_payload の shape、state 1..5、state_changed、Compass、retry 時の契約再指示を文言として返す責務だけを持つ。
Future Chain v3.1 の future_chain_context / handoff_message_snapshot 生成、Future Chain 保存、表示、配信判定は担当しない。
OpenAI completion 実行、timeout / retry 実行、JSON parse、契約検証、DB保存復元、HOPY唯一の正の再判定、Future Chain の意味生成・保存・表示は担当しない。

【今回このファイルで修正したこと】
- OpenAI JSON契約内で future_chain_context を任意返却できる余地を削除しました。
- hopy_confirmed_payload.future_chain_context も返さない境界ルールへ変更しました。
- owner_handoff / recipient_support / recipient_support_query / handoff_message_snapshot を OpenAI JSON内で生成しない指示へ統一しました。
- Future Chain v3.1 の future_chain_context / handoff_message_snapshot は回答確定後の専用処理で作る方針へそろえました。
- top-level future_chain_context 禁止は維持しました。
- state 1..5、state_changed、Compass、confirmed_memory_candidates の契約は維持しました。
- DB、UI、Future Chain 保存処理、表示処理、plan gate、HOPY唯一の正の再判定はこのファイルでは触っていません。

/app/api/chat/_lib/hopy/prompt/hopyOpenAIJsonContractPrompt.ts
*/