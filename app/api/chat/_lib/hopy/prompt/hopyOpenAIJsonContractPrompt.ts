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
      "hopy_confirmed_payload.state は、同じ messages 内で渡されるサーバ計算済み状態材料と一致させること。",
      "current_phase / state_level / prev_phase / prev_state_level / state_changed を、ユーザー入力・回答本文・雰囲気から再判定してはならない。",
      "state_changed を false に固定したり、無難だから false にしたりしてはならない。",
      "state_changed は、サーバ計算済み状態材料の state_changed と一致させること。",
      "下の JSON は出力形を守るための構造例であり、state の数値や boolean は固定値ではない。",
      "実際の current_phase / state_level / prev_phase / prev_state_level / state_changed は、同じ messages 内の状態材料プロンプトで指定された値に一致させること。",
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
      "重要: 上の 3 / 2 / true は固定コピー禁止。実際の値は、同じ messages 内の状態材料プロンプトに一致させること。",
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
    "hopy_confirmed_payload.state must match the server-computed state material provided in the same messages.",
    "Do not re-judge current_phase, state_level, prev_phase, prev_state_level, or state_changed from the user input, reply wording, or atmosphere.",
    "Do not default state_changed to false just because it looks safer.",
    "state_changed must match the server-computed state_changed value from the state material.",
    "The JSON below is a structure example for valid output. The state numbers and boolean are not fixed values.",
    "The actual current_phase, state_level, prev_phase, prev_state_level, and state_changed must match the state material prompt provided in the same messages.",
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
    "Important: the 3 / 2 / true values must not be copied blindly. The actual values must match the state material prompt provided in the same messages.",
    "Important: Future Chain v3.1 handoff_message_snapshot must not be generated as JSON here; it is created by the post-confirmation dedicated flow.",
  ].join("\n");
}

export function buildStateMeaningSystem(args: { uiLang: Lang }): string {
  if (args.uiLang === "ja") {
    return [
      "状態反映ルール:",
      "hopy_confirmed_payload.state は、同じ messages 内で渡されるサーバ計算済み状態材料に一致させること。",
      "prev_phase / prev_state_level は、状態材料で指定された直前確定状態をそのまま使うこと。",
      "current_phase / state_level は、状態材料で指定された今回ターンの状態をそのまま使うこと。",
      "state_changed は、状態材料で指定された boolean 値をそのまま使うこと。",
      "ユーザー入力や最終返答の意味から current_phase / state_level / state_changed を再判定してはならない。",
      "HOPYが候補から一つを提案しただけで、ユーザーの状態変化を作ってはならない。",
      "current と prev の差分から state_changed を自作してはならない。",
      "固定値コピーで逃げるのではなく、同じ messages 内の状態材料プロンプトに一致させること。",
      "下流は再判定しないため、この契約で状態材料と異なる値を返してはならない。",
    ].join("\n");
  }

  return [
    "State reflection rule:",
    "hopy_confirmed_payload.state must match the server-computed state material provided in the same messages.",
    "prev_phase and prev_state_level must use the pre-turn confirmed state specified by the state material.",
    "current_phase and state_level must use the current turn state specified by the state material.",
    "state_changed must use the boolean value specified by the state material.",
    "Do not re-judge current_phase, state_level, or state_changed from the meaning of the user input or final reply.",
    "Do not create a user state transition merely because HOPY suggested one option.",
    "Do not calculate state_changed yourself from the difference between current and prev.",
    "Do not escape by copying example values; match the state material prompt provided in the same messages.",
    "Downstream will not re-judge this, so this contract must not return state values that differ from the state material.",
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
      "hopy_confirmed_payload.state は、同じ messages 内の状態材料プロンプトに一致させてください。",
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
    "hopy_confirmed_payload.state must match the state material prompt provided in the same messages.",
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
      "hopy_confirmed_payload.state は、同じ messages 内の状態材料プロンプトに一致させてください。",
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
      "重要: 上の 3 / 2 / true は固定コピー禁止。実際の値は、同じ messages 内の状態材料プロンプトに一致させること。",
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
    "hopy_confirmed_payload.state must match the state material prompt provided in the same messages.",
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
    "Important: the 3 / 2 / true values must not be copied blindly. The actual values must match the state material prompt provided in the same messages.",
  ].join("\n");
}

/*
【このファイルの正式役割】
OpenAI 実行層で使う HOPY JSON 契約プロンプト文言を生成するファイル。
hopy_confirmed_payload の shape、state 1..5、state_changed、Compass、retry 時の契約再指示を文言として返す責務だけを持つ。
Future Chain v3.1 の future_chain_context / handoff_message_snapshot 生成、Future Chain 保存、表示、配信判定は担当しない。
OpenAI completion 実行、timeout / retry 実行、JSON parse、契約検証、DB保存復元、HOPY唯一の正の再判定、Future Chain の意味生成・保存・表示は担当しない。

【今回このファイルで修正したこと】
- OpenAI JSON契約内の「今回ターンの意味でstateを決め直す」「ユーザー入力と最終返答の意味からstateを決める」文言を削除しました。
- hopy_confirmed_payload.state は、同じ messages 内で渡されるサーバ計算済み状態材料に一致させる契約へ変更しました。
- current_phase / state_level / prev_phase / prev_state_level / state_changed を、ユーザー入力・回答本文・雰囲気から再判定しない文言へ統一しました。
- JSON構造例の数値は固定コピーせず、状態材料プロンプトに一致させる文言へ変更しました。
- Future Chain v3.1 の future_chain_context / handoff_message_snapshot は、引き続き回答確定後の専用処理で作る方針を維持しました。
- state 1..5、Compass、confirmed_memory_candidates、Future Chain境界ルールは維持しました。
- DB、UI、Future Chain保存処理、表示処理、plan gate、HOPY回答○表示処理には触れていません。

/app/api/chat/_lib/hopy/prompt/hopyOpenAIJsonContractPrompt.ts
*/