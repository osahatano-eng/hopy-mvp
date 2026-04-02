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
        max_tokens: MEMORY_RECOVERY_MAX_TOKENS,
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