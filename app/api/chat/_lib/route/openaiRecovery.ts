// /app/api/chat/_lib/route/openaiRecovery.ts
import OpenAI from "openai";

import { phaseParams } from "../phase/phaseParams";
import type { Lang } from "../router/simpleRouter";
import { memoryRecoveryContractSystem } from "./openaiContracts";
import { extractAssistantReplyPayload } from "./openaiParsing";
import { withTimeout, type OpenAIChatMessage } from "./openaiExecution";

const MEMORY_RECOVERY_MAX_TOKENS = 220;

export async function recoverMemoryCandidatesFromPlainReply(params: {
  openai: OpenAI;
  modelName: string;
  replyLang: Lang;
  userText: string;
  assistantText: string;
  phaseForParams: 1 | 2 | 3 | 4 | 5;
  openaiTimeoutMs: number;
}): Promise<unknown[]> {
  const {
    openai,
    modelName,
    replyLang,
    userText,
    assistantText,
    phaseForParams,
    openaiTimeoutMs,
  } = params;

  if (!assistantText.trim()) return [];

  try {
    const recoveryMessages: OpenAIChatMessage[] = [
      { role: "system", content: memoryRecoveryContractSystem(replyLang) },
      {
        role: "user",
        content: [
          `user_message: ${userText}`,
          `assistant_reply: ${assistantText}`,
        ].join("\n"),
      },
    ];

    const completion = await withTimeout(
      openai.chat.completions.create({
        model: modelName,
        messages: recoveryMessages,
        temperature: 0.0,
        response_format: { type: "json_object" },
        ...phaseParams(phaseForParams),
      }),
      Math.max(1500, Math.min(openaiTimeoutMs, 4000)),
      "openai_memory_recover",
    );

    const rawContent = String(completion.choices?.[0]?.message?.content ?? "");
    const extracted = extractAssistantReplyPayload(rawContent);

    return Array.isArray(extracted.confirmed_memory_candidates)
      ? extracted.confirmed_memory_candidates
      : [];
  } catch {
    return [];
  }
}

/*
このファイルの正式役割:
assistant の通常本文しか得られていない場合に、
その本文と user_message をもとに memory 候補を JSON で再抽出する回復用ファイル。
OpenAI へ recoveryMessages を渡し、短い補助 completion を実行して、
confirmed_memory_candidates を安全に復元する責務を持つ。
*/

/*
【今回このファイルで修正したこと】
- openai.chat.completions.create(...) で重複指定されていた max_tokens: MEMORY_RECOVERY_MAX_TOKENS を削除しました。
- max_tokens は phaseParams(phaseForParams) 側の値だけを使う形にそろえ、TypeScript の重複指定 build error を止めました。
- それ以外の temperature、response_format、memory recovery の抽出処理は触っていません。
*/