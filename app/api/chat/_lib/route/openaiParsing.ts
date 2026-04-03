// /app/api/chat/_lib/route/openaiParsing.ts
import { clampText } from "../infra/text";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown, max = 8000): string {
  if (typeof value !== "string") return "";
  return clampText(value, max);
}

export function safeParseJsonObject(
  text: string,
): Record<string, unknown> | null {
  const source = String(text ?? "").trim();
  if (!source) return null;

  try {
    const parsed = JSON.parse(source);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // noop
  }

  const fencedPatterns = [
    /```json\s*([\s\S]*?)\s*```/i,
    /```\s*([\s\S]*?)\s*```/i,
  ];

  for (const pattern of fencedPatterns) {
    const fencedMatch = source.match(pattern);
    if (!fencedMatch?.[1]) continue;

    try {
      const parsed = JSON.parse(fencedMatch[1]);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // noop
    }
  }

  return null;
}

export function hasReplyPayloadShape(parsed: Record<string, unknown>): boolean {
  return (
    "reply" in parsed ||
    "assistantText" in parsed ||
    "assistant_text" in parsed ||
    "content" in parsed ||
    "confirmed_memory_candidates" in parsed ||
    "memory_candidates" in parsed ||
    "state" in parsed ||
    "assistant_state" in parsed ||
    "hopy_confirmed_payload" in parsed ||
    "hopyConfirmedPayload" in parsed ||
    "compass" in parsed ||
    "compassText" in parsed ||
    "compass_text" in parsed ||
    "compassPrompt" in parsed ||
    "compass_prompt" in parsed ||
    "ui_effects" in parsed ||
    "uiEffects" in parsed
  );
}

export function tryExtractTrailingJsonObject(text: string): {
  parsed: Record<string, unknown>;
  prefixText: string;
} | null {
  const source = String(text ?? "").trim();
  if (!source) return null;

  let index = source.lastIndexOf("{");

  while (index >= 0) {
    const candidate = source.slice(index).trim();
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const objectParsed = parsed as Record<string, unknown>;
        if (hasReplyPayloadShape(objectParsed)) {
          const prefixText = source.slice(0, index).trim();
          return {
            parsed: objectParsed,
            prefixText,
          };
        }
      }
    } catch {
      // noop
    }

    index = source.lastIndexOf("{", index - 1);
  }

  return null;
}

export function extractConfirmedMemoryCandidatesFromParsed(
  parsed: Record<string, unknown>,
): unknown[] {
  if (Array.isArray(parsed.confirmed_memory_candidates)) {
    return parsed.confirmed_memory_candidates;
  }

  if (Array.isArray(parsed.memory_candidates)) {
    return parsed.memory_candidates;
  }

  const confirmedPayload =
    asRecord(parsed.hopy_confirmed_payload) ??
    asRecord(parsed.hopyConfirmedPayload);

  if (confirmedPayload && Array.isArray(confirmedPayload.memory_candidates)) {
    return confirmedPayload.memory_candidates;
  }

  return [];
}

function extractConfirmedPayloadFromParsed(
  parsed: Record<string, unknown>,
): Record<string, unknown> | null {
  return (
    asRecord(parsed.hopy_confirmed_payload) ??
    asRecord(parsed.hopyConfirmedPayload)
  );
}

function extractUiEffectsFromParsed(
  parsed: Record<string, unknown>,
): Record<string, unknown> | null {
  const confirmedPayload = extractConfirmedPayloadFromParsed(parsed);

  return (
    asRecord(confirmedPayload?.ui_effects) ??
    asRecord(confirmedPayload?.uiEffects) ??
    asRecord(parsed.ui_effects) ??
    asRecord(parsed.uiEffects)
  );
}

export function extractStateFromParsed(
  parsed: Record<string, unknown>,
): Record<string, unknown> | null {
  const confirmedPayload = extractConfirmedPayloadFromParsed(parsed);

  return (
    asRecord(confirmedPayload?.state) ??
    asRecord(parsed.state) ??
    asRecord(parsed.assistant_state)
  );
}

export function extractCompassTextFromParsed(
  parsed: Record<string, unknown>,
): string {
  const confirmedPayload = extractConfirmedPayloadFromParsed(parsed);
  const confirmedCompass = asRecord(confirmedPayload?.compass);
  const directCompass = asRecord(parsed.compass);
  const uiEffects = extractUiEffectsFromParsed(parsed);
  const uiEffectsCompass = asRecord(uiEffects?.compass);

  return (
    readString(confirmedCompass?.text) ||
    readString(confirmedPayload?.compassText) ||
    readString(confirmedPayload?.compass_text) ||
    readString(uiEffectsCompass?.text) ||
    readString(parsed.compassText) ||
    readString(parsed.compass_text) ||
    readString(directCompass?.text)
  );
}

export function extractCompassPromptFromParsed(
  parsed: Record<string, unknown>,
): string {
  const confirmedPayload = extractConfirmedPayloadFromParsed(parsed);
  const confirmedCompass = asRecord(confirmedPayload?.compass);
  const directCompass = asRecord(parsed.compass);
  const uiEffects = extractUiEffectsFromParsed(parsed);
  const uiEffectsCompass = asRecord(uiEffects?.compass);

  return (
    readString(confirmedCompass?.prompt) ||
    readString(confirmedPayload?.compassPrompt) ||
    readString(confirmedPayload?.compass_prompt) ||
    readString(uiEffectsCompass?.prompt) ||
    readString(parsed.compassPrompt) ||
    readString(parsed.compass_prompt) ||
    readString(directCompass?.prompt)
  );
}

function normalizeReplyTextValue(value: unknown): string {
  const text = String(value ?? "");
  if (!text.trim()) return "";

  const trailingJson = tryExtractTrailingJsonObject(text);
  if (trailingJson) {
    const parsedReply = extractReplyTextFromParsed(
      trailingJson.parsed,
      trailingJson.prefixText,
    );
    return clampText(parsedReply || trailingJson.prefixText || text, 8000);
  }

  return clampText(text, 8000);
}

export function extractReplyTextFromParsed(
  parsed: Record<string, unknown>,
  fallbackText = "",
): string {
  const confirmedPayload = extractConfirmedPayloadFromParsed(parsed);

  const candidate =
    confirmedPayload?.reply ??
    confirmedPayload?.assistantText ??
    confirmedPayload?.assistant_text ??
    confirmedPayload?.content ??
    parsed.reply ??
    parsed.assistantText ??
    parsed.assistant_text ??
    parsed.content ??
    fallbackText ??
    "";

  return normalizeReplyTextValue(candidate);
}

export function extractAssistantReplyPayload(rawContent: string): {
  assistantText: string;
  confirmed_memory_candidates: unknown[];
  parsed_json: Record<string, unknown> | null;
  compassText: string;
  compassPrompt: string;
  state: Record<string, unknown> | null;
} {
  const parsed = safeParseJsonObject(rawContent);

  if (parsed) {
    return {
      assistantText: extractReplyTextFromParsed(parsed),
      confirmed_memory_candidates: extractConfirmedMemoryCandidatesFromParsed(
        parsed,
      ),
      parsed_json: parsed,
      compassText: extractCompassTextFromParsed(parsed),
      compassPrompt: extractCompassPromptFromParsed(parsed),
      state: extractStateFromParsed(parsed),
    };
  }

  const trailingJson = tryExtractTrailingJsonObject(rawContent);
  if (trailingJson) {
    return {
      assistantText: extractReplyTextFromParsed(
        trailingJson.parsed,
        trailingJson.prefixText,
      ),
      confirmed_memory_candidates: extractConfirmedMemoryCandidatesFromParsed(
        trailingJson.parsed,
      ),
      parsed_json: trailingJson.parsed,
      compassText: extractCompassTextFromParsed(trailingJson.parsed),
      compassPrompt: extractCompassPromptFromParsed(trailingJson.parsed),
      state: extractStateFromParsed(trailingJson.parsed),
    };
  }

  return {
    assistantText: clampText(rawContent, 8000),
    confirmed_memory_candidates: [],
    parsed_json: null,
    compassText: "",
    compassPrompt: "",
    state: null,
  };
}

/*
このファイルの正式役割:
OpenAI 生出力から、確定意味ペイロードを抽出する解析ファイル。
assistantText / confirmed_memory_candidates / state / compassText / compassPrompt
を、hopy_confirmed_payload または hopyConfirmedPayload を中心に取り出して返す。
下流の再判定や再救出に繋がる曖昧な本文推測は持たず、
正式な抽出元が欠けている場合は欠けたまま返す。
*/

/*
【今回このファイルで修正したこと】
- hopy_confirmed_payload.ui_effects / uiEffects を正式抽出対象に追加しました。
- Compass の抽出順序を、confirmed payload 内の compass とフラットキーを優先し、その次に confirmed payload 内 ui_effects.compass を見る形へそろえました。
- これにより、唯一の正に最も近い confirmed payload 内の ui_effects に入っている Compass を parser で欠落させず下流へ渡せるようにしました。
- それ以外の parsed_json / state / memory_candidates / reply の抽出順序は変更していません。
*/
// このファイルの正式役割: OpenAI 生出力から、確定意味ペイロードを抽出する解析ファイル

/*
【今回このファイルで修正したこと】
confirmed payload 内の ui_effects.compass を抽出できるように修正しました。
Compass の抽出優先順も、唯一の正に近い confirmed payload 側を先に見る形へそろえました。
*/