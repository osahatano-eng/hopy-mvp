// /app/api/chat/_lib/db/saveMessageCore.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type Lang = "ja" | "en";

export type MessageStateFields = {
  state_level?: number;
  current_phase?: number;
  state_changed?: boolean;
  prev_phase?: number;
  prev_state_level?: number;
};

export type MessageCompassFields = {
  compass_text?: string;
  compass_prompt?: string;
};

export type MessageAssistantIdentityFields = {
  assistant_message_id?: string;
};

export type SaveMessageCoreParams = {
  supabase: SupabaseClient;
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  state_level?: number;
  current_phase?: number;
  state_changed?: boolean;
  prev_phase?: number;
  prev_state_level?: number;
  compass_text?: string;
  compass_prompt?: string;
  assistant_message_id?: string;
};

export type SaveExecutionMode = "returning" | "lite";

export type InsertAttemptParams = {
  supabase: SupabaseClient;
  payload: Record<string, unknown>;
  mode: SaveExecutionMode;
};

export type InsertAttemptResult =
  | { ok: true; id: string }
  | { ok: true }
  | { ok: false; error: any };

function reqNonEmpty(name: string, v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) {
    throw new Error(`${name}_empty`);
  }
  return s;
}

function normalizeLang(v: unknown): Lang {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "en" ? "en" : "ja";
}

function normalizeRole(v: unknown): "user" | "assistant" {
  const s = String(v ?? "").trim();
  return s === "assistant" ? "assistant" : "user";
}

function normalizeOptionalInt(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n);
}

function normalizeOptionalBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
    return undefined;
  }
  const s = String(v).trim().toLowerCase();
  if (s === "true" || s === "1") return true;
  if (s === "false" || s === "0") return false;
  return undefined;
}

function normalizeOptionalText(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * HOPY の状態は 5 段階固定
 * - state_level: 1..5
 * - current_phase: 1..5
 * - prev_state_level: 1..5
 * - prev_phase: 1..5
 *
 * 保存層では caller / confirmedTurn から受け取った正式値を
 * そのまま正として保存する。
 * ここで別の列から作り直したり、片方を補完したりしない。
 */
function normalizePhase5(v: unknown): number | undefined {
  const n = normalizeOptionalInt(v);
  if (n === undefined) return undefined;
  return clampInt(n, 1, 5);
}

function normalizeLevel5(v: unknown): number | undefined {
  const n = normalizeOptionalInt(v);
  if (n === undefined) return undefined;
  return clampInt(n, 1, 5);
}

function buildStateFields(params: MessageStateFields) {
  const out: Record<string, unknown> = {};

  const stateLevel = normalizeLevel5(params.state_level);
  const currentPhase = normalizePhase5(params.current_phase);
  const prevStateLevel = normalizeLevel5(params.prev_state_level);
  const prevPhase = normalizePhase5(params.prev_phase);
  const stateChanged = normalizeOptionalBool(params.state_changed);

  if (stateLevel !== undefined) out.state_level = stateLevel;
  if (currentPhase !== undefined) out.current_phase = currentPhase;
  if (stateChanged !== undefined) out.state_changed = stateChanged;
  if (prevPhase !== undefined) out.prev_phase = prevPhase;
  if (prevStateLevel !== undefined) out.prev_state_level = prevStateLevel;

  return out;
}

function buildCompassFields(params: MessageCompassFields) {
  const out: Record<string, unknown> = {};

  const compassText = normalizeOptionalText(params.compass_text);
  const compassPrompt = normalizeOptionalText(params.compass_prompt);

  if (compassText !== undefined) out.compass_text = compassText;
  if (compassPrompt !== undefined) out.compass_prompt = compassPrompt;

  return out;
}

function buildAssistantIdentityFields(params: MessageAssistantIdentityFields) {
  const out: Record<string, unknown> = {};

  const assistantMessageId = normalizeOptionalText(params.assistant_message_id);

  if (assistantMessageId !== undefined) {
    out.assistant_message_id = assistantMessageId;
  }

  return out;
}

function hasRequestedCompass(params: MessageCompassFields): boolean {
  return (
    normalizeOptionalText(params.compass_text) !== undefined ||
    normalizeOptionalText(params.compass_prompt) !== undefined
  );
}

function hasRequestedState(params: MessageStateFields): boolean {
  return (
    normalizeLevel5(params.state_level) !== undefined ||
    normalizePhase5(params.current_phase) !== undefined ||
    normalizeOptionalBool(params.state_changed) !== undefined ||
    normalizePhase5(params.prev_phase) !== undefined ||
    normalizeLevel5(params.prev_state_level) !== undefined
  );
}

function hasRequestedAssistantIdentity(
  params: MessageAssistantIdentityFields,
): boolean {
  return normalizeOptionalText(params.assistant_message_id) !== undefined;
}

function errMsg(e: any): string {
  return String(e?.message ?? e?.error_description ?? e ?? "")
    .trim()
    .toLowerCase();
}

function shouldFallbackToThreadIdColumn(e: any): boolean {
  const m = errMsg(e);

  if (
    m.includes("conversation_id") &&
    (m.includes("does not exist") ||
      m.includes("unknown column") ||
      m.includes("not exist"))
  ) {
    return true;
  }

  if (m.includes("conversation_id") && m.includes("schema cache")) return true;

  const code = String(e?.code ?? "").trim();
  if (code === "42703" && m.includes("conversation_id")) return true;

  return false;
}

function shouldFallbackWithoutStateColumns(e: any): boolean {
  const m = errMsg(e);
  const code = String(e?.code ?? "").trim();

  const stateColumnNames = [
    "state_level",
    "current_phase",
    "state_changed",
    "prev_phase",
    "prev_state_level",
  ];

  const mentionsStateColumn = stateColumnNames.some((name) =>
    m.includes(name),
  );
  const mentionsMissingColumn =
    m.includes("does not exist") ||
    m.includes("unknown column") ||
    m.includes("not exist") ||
    m.includes("schema cache");

  if (mentionsStateColumn && mentionsMissingColumn) return true;
  if (code === "42703" && mentionsStateColumn) return true;

  return false;
}

function shouldFallbackWithoutCompassColumns(e: any): boolean {
  const m = errMsg(e);
  const code = String(e?.code ?? "").trim();

  const compassColumnNames = ["compass_text", "compass_prompt"];

  const mentionsCompassColumn = compassColumnNames.some((name) =>
    m.includes(name),
  );
  const mentionsMissingColumn =
    m.includes("does not exist") ||
    m.includes("unknown column") ||
    m.includes("not exist") ||
    m.includes("schema cache");

  if (mentionsCompassColumn && mentionsMissingColumn) return true;
  if (code === "42703" && mentionsCompassColumn) return true;

  return false;
}

function shouldFallbackWithoutAssistantMessageIdColumn(e: any): boolean {
  const m = errMsg(e);
  const code = String(e?.code ?? "").trim();

  const mentionsAssistantMessageId = m.includes("assistant_message_id");
  const mentionsMissingColumn =
    m.includes("does not exist") ||
    m.includes("unknown column") ||
    m.includes("not exist") ||
    m.includes("schema cache");

  if (mentionsAssistantMessageId && mentionsMissingColumn) return true;
  if (code === "42703" && mentionsAssistantMessageId) return true;

  return false;
}

function buildPayload(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  state_level?: number;
  current_phase?: number;
  state_changed?: boolean;
  prev_phase?: number;
  prev_state_level?: number;
  compass_text?: string;
  compass_prompt?: string;
  assistant_message_id?: string;
}) {
  const uid = reqNonEmpty("userId", params.userId);
  const cid = reqNonEmpty("conversationId", params.conversationId);
  const body = reqNonEmpty("content", params.content);

  return {
    user_id: uid,
    conversation_id: cid,
    role: normalizeRole(params.role),
    content: body,
    lang: normalizeLang(params.lang),
    ...buildStateFields(params),
    ...buildCompassFields(params),
    ...buildAssistantIdentityFields(params),
  };
}

function buildPayloadFallbackThreadId(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  state_level?: number;
  current_phase?: number;
  state_changed?: boolean;
  prev_phase?: number;
  prev_state_level?: number;
  compass_text?: string;
  compass_prompt?: string;
  assistant_message_id?: string;
}) {
  const uid = reqNonEmpty("userId", params.userId);
  const cid = reqNonEmpty("conversationId", params.conversationId);
  const body = reqNonEmpty("content", params.content);

  return {
    user_id: uid,
    thread_id: cid,
    role: normalizeRole(params.role),
    content: body,
    lang: normalizeLang(params.lang),
    ...buildStateFields(params),
    ...buildCompassFields(params),
    ...buildAssistantIdentityFields(params),
  };
}

function buildPayloadWithoutState(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  compass_text?: string;
  compass_prompt?: string;
  assistant_message_id?: string;
}) {
  const uid = reqNonEmpty("userId", params.userId);
  const cid = reqNonEmpty("conversationId", params.conversationId);
  const body = reqNonEmpty("content", params.content);

  return {
    user_id: uid,
    conversation_id: cid,
    role: normalizeRole(params.role),
    content: body,
    lang: normalizeLang(params.lang),
    ...buildCompassFields(params),
    ...buildAssistantIdentityFields(params),
  };
}

function buildPayloadFallbackThreadIdWithoutState(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  compass_text?: string;
  compass_prompt?: string;
  assistant_message_id?: string;
}) {
  const uid = reqNonEmpty("userId", params.userId);
  const cid = reqNonEmpty("conversationId", params.conversationId);
  const body = reqNonEmpty("content", params.content);

  return {
    user_id: uid,
    thread_id: cid,
    role: normalizeRole(params.role),
    content: body,
    lang: normalizeLang(params.lang),
    ...buildCompassFields(params),
    ...buildAssistantIdentityFields(params),
  };
}

function buildPayloadWithoutAssistantMessageId(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  state_level?: number;
  current_phase?: number;
  state_changed?: boolean;
  prev_phase?: number;
  prev_state_level?: number;
  compass_text?: string;
  compass_prompt?: string;
}) {
  const uid = reqNonEmpty("userId", params.userId);
  const cid = reqNonEmpty("conversationId", params.conversationId);
  const body = reqNonEmpty("content", params.content);

  return {
    user_id: uid,
    conversation_id: cid,
    role: normalizeRole(params.role),
    content: body,
    lang: normalizeLang(params.lang),
    ...buildStateFields(params),
    ...buildCompassFields(params),
  };
}

function buildPayloadFallbackThreadIdWithoutAssistantMessageId(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  state_level?: number;
  current_phase?: number;
  state_changed?: boolean;
  prev_phase?: number;
  prev_state_level?: number;
  compass_text?: string;
  compass_prompt?: string;
}) {
  const uid = reqNonEmpty("userId", params.userId);
  const cid = reqNonEmpty("conversationId", params.conversationId);
  const body = reqNonEmpty("content", params.content);

  return {
    user_id: uid,
    thread_id: cid,
    role: normalizeRole(params.role),
    content: body,
    lang: normalizeLang(params.lang),
    ...buildStateFields(params),
    ...buildCompassFields(params),
  };
}

function buildPayloadWithoutStateAndAssistantMessageId(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  compass_text?: string;
  compass_prompt?: string;
}) {
  const uid = reqNonEmpty("userId", params.userId);
  const cid = reqNonEmpty("conversationId", params.conversationId);
  const body = reqNonEmpty("content", params.content);

  return {
    user_id: uid,
    conversation_id: cid,
    role: normalizeRole(params.role),
    content: body,
    lang: normalizeLang(params.lang),
    ...buildCompassFields(params),
  };
}

function buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId(params: {
  userId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  lang: Lang;
  compass_text?: string;
  compass_prompt?: string;
}) {
  const uid = reqNonEmpty("userId", params.userId);
  const cid = reqNonEmpty("conversationId", params.conversationId);
  const body = reqNonEmpty("content", params.content);

  return {
    user_id: uid,
    thread_id: cid,
    role: normalizeRole(params.role),
    content: body,
    lang: normalizeLang(params.lang),
    ...buildCompassFields(params),
  };
}

async function insertMessageAttempt(
  params: InsertAttemptParams,
): Promise<InsertAttemptResult> {
  const { supabase, payload, mode } = params;

  if (mode === "returning") {
    const { data, error } = await supabase
      .from("messages")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return { ok: false, error };
    }

    const id = String((data as any)?.id ?? "").trim();
    if (!id) {
      return { ok: false, error: "insert_no_id" };
    }

    return { ok: true, id };
  }

  const { error } = await supabase.from("messages").insert(payload);
  if (error) {
    return { ok: false, error };
  }

  return { ok: true };
}

export async function saveMessageCore(
  params: SaveMessageCoreParams & {
    mode: SaveExecutionMode;
  },
): Promise<InsertAttemptResult> {
  const {
    supabase,
    userId,
    conversationId,
    role,
    content,
    lang,
    mode,
    ...optionalParams
  } = params;

  const requestedCompass = hasRequestedCompass(optionalParams);
  const requestedState = hasRequestedState(optionalParams);
  const requestedAssistantIdentity =
    hasRequestedAssistantIdentity(optionalParams);

  const attemptPrimary = await insertMessageAttempt({
    supabase,
    mode,
    payload: buildPayload({
      userId,
      conversationId,
      role,
      content,
      lang,
      ...optionalParams,
    }),
  });

  if (attemptPrimary.ok) return attemptPrimary;
  const error = attemptPrimary.error;

  if (shouldFallbackWithoutAssistantMessageIdColumn(error)) {
    if (requestedAssistantIdentity) {
      return { ok: false, error };
    }

    const attemptNoAssistantMessageId = await insertMessageAttempt({
      supabase,
      mode,
      payload: buildPayloadWithoutAssistantMessageId({
        userId,
        conversationId,
        role,
        content,
        lang,
        state_level: optionalParams.state_level,
        current_phase: optionalParams.current_phase,
        state_changed: optionalParams.state_changed,
        prev_phase: optionalParams.prev_phase,
        prev_state_level: optionalParams.prev_state_level,
        compass_text: optionalParams.compass_text,
        compass_prompt: optionalParams.compass_prompt,
      }),
    });

    if (attemptNoAssistantMessageId.ok) return attemptNoAssistantMessageId;
    const errorNoAssistantMessageId = attemptNoAssistantMessageId.error;

    if (shouldFallbackWithoutCompassColumns(errorNoAssistantMessageId)) {
      if (requestedCompass) {
        return { ok: false, error: errorNoAssistantMessageId };
      }

      const attemptNoAssistantMessageIdNoCompass =
        await insertMessageAttempt({
          supabase,
          mode,
          payload: buildPayloadWithoutAssistantMessageId({
            userId,
            conversationId,
            role,
            content,
            lang,
            state_level: optionalParams.state_level,
            current_phase: optionalParams.current_phase,
            state_changed: optionalParams.state_changed,
            prev_phase: optionalParams.prev_phase,
            prev_state_level: optionalParams.prev_state_level,
          }),
        });

      if (attemptNoAssistantMessageIdNoCompass.ok) {
        return attemptNoAssistantMessageIdNoCompass;
      }
      const errorNoAssistantMessageIdNoCompass =
        attemptNoAssistantMessageIdNoCompass.error;

      if (
        shouldFallbackToThreadIdColumn(errorNoAssistantMessageIdNoCompass)
      ) {
        const attemptThreadNoAssistantMessageIdNoCompass =
          await insertMessageAttempt({
            supabase,
            mode,
            payload: buildPayloadFallbackThreadIdWithoutAssistantMessageId({
              userId,
              conversationId,
              role,
              content,
              lang,
              state_level: optionalParams.state_level,
              current_phase: optionalParams.current_phase,
              state_changed: optionalParams.state_changed,
              prev_phase: optionalParams.prev_phase,
              prev_state_level: optionalParams.prev_state_level,
            }),
          });

        if (attemptThreadNoAssistantMessageIdNoCompass.ok) {
          return attemptThreadNoAssistantMessageIdNoCompass;
        }
        const errorThreadNoAssistantMessageIdNoCompass =
          attemptThreadNoAssistantMessageIdNoCompass.error;

        if (
          shouldFallbackWithoutStateColumns(
            errorThreadNoAssistantMessageIdNoCompass,
          )
        ) {
          if (requestedState) {
            return {
              ok: false,
              error: errorThreadNoAssistantMessageIdNoCompass,
            };
          }

          return await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
              }),
          });
        }

        return { ok: false, error: errorThreadNoAssistantMessageIdNoCompass };
      }

      if (shouldFallbackWithoutStateColumns(errorNoAssistantMessageIdNoCompass)) {
        if (requestedState) {
          return { ok: false, error: errorNoAssistantMessageIdNoCompass };
        }

        return await insertMessageAttempt({
          supabase,
          mode,
          payload: buildPayloadWithoutStateAndAssistantMessageId({
            userId,
            conversationId,
            role,
            content,
            lang,
          }),
        });
      }

      return { ok: false, error: errorNoAssistantMessageIdNoCompass };
    }

    if (shouldFallbackToThreadIdColumn(errorNoAssistantMessageId)) {
      const attemptThreadNoAssistantMessageId = await insertMessageAttempt({
        supabase,
        mode,
        payload: buildPayloadFallbackThreadIdWithoutAssistantMessageId({
          userId,
          conversationId,
          role,
          content,
          lang,
          state_level: optionalParams.state_level,
          current_phase: optionalParams.current_phase,
          state_changed: optionalParams.state_changed,
          prev_phase: optionalParams.prev_phase,
          prev_state_level: optionalParams.prev_state_level,
          compass_text: optionalParams.compass_text,
          compass_prompt: optionalParams.compass_prompt,
        }),
      });

      if (attemptThreadNoAssistantMessageId.ok) {
        return attemptThreadNoAssistantMessageId;
      }
      const errorThreadNoAssistantMessageId =
        attemptThreadNoAssistantMessageId.error;

      if (shouldFallbackWithoutCompassColumns(errorThreadNoAssistantMessageId)) {
        if (requestedCompass) {
          return { ok: false, error: errorThreadNoAssistantMessageId };
        }

        const attemptThreadNoAssistantMessageIdNoCompass =
          await insertMessageAttempt({
            supabase,
            mode,
            payload: buildPayloadFallbackThreadIdWithoutAssistantMessageId({
              userId,
              conversationId,
              role,
              content,
              lang,
              state_level: optionalParams.state_level,
              current_phase: optionalParams.current_phase,
              state_changed: optionalParams.state_changed,
              prev_phase: optionalParams.prev_phase,
              prev_state_level: optionalParams.prev_state_level,
            }),
          });

        if (attemptThreadNoAssistantMessageIdNoCompass.ok) {
          return attemptThreadNoAssistantMessageIdNoCompass;
        }
        const errorThreadNoAssistantMessageIdNoCompass =
          attemptThreadNoAssistantMessageIdNoCompass.error;

        if (
          shouldFallbackWithoutStateColumns(
            errorThreadNoAssistantMessageIdNoCompass,
          )
        ) {
          if (requestedState) {
            return {
              ok: false,
              error: errorThreadNoAssistantMessageIdNoCompass,
            };
          }

          return await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
              }),
          });
        }

        return { ok: false, error: errorThreadNoAssistantMessageIdNoCompass };
      }

      if (shouldFallbackWithoutStateColumns(errorThreadNoAssistantMessageId)) {
        if (requestedState) {
          return { ok: false, error: errorThreadNoAssistantMessageId };
        }

        const attemptThreadNoStateNoAssistantMessageId =
          await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
                compass_text: optionalParams.compass_text,
                compass_prompt: optionalParams.compass_prompt,
              }),
          });

        if (attemptThreadNoStateNoAssistantMessageId.ok) {
          return attemptThreadNoStateNoAssistantMessageId;
        }
        const errorThreadNoStateNoAssistantMessageId =
          attemptThreadNoStateNoAssistantMessageId.error;

        if (
          shouldFallbackWithoutCompassColumns(
            errorThreadNoStateNoAssistantMessageId,
          )
        ) {
          if (requestedCompass) {
            return { ok: false, error: errorThreadNoStateNoAssistantMessageId };
          }

          return await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
              }),
          });
        }

        return { ok: false, error: errorThreadNoStateNoAssistantMessageId };
      }

      return { ok: false, error: errorThreadNoAssistantMessageId };
    }

    if (shouldFallbackWithoutStateColumns(errorNoAssistantMessageId)) {
      if (requestedState) {
        return { ok: false, error: errorNoAssistantMessageId };
      }

      const attemptNoStateNoAssistantMessageId = await insertMessageAttempt({
        supabase,
        mode,
        payload: buildPayloadWithoutStateAndAssistantMessageId({
          userId,
          conversationId,
          role,
          content,
          lang,
          compass_text: optionalParams.compass_text,
          compass_prompt: optionalParams.compass_prompt,
        }),
      });

      if (attemptNoStateNoAssistantMessageId.ok) {
        return attemptNoStateNoAssistantMessageId;
      }
      const errorNoStateNoAssistantMessageId =
        attemptNoStateNoAssistantMessageId.error;

      if (shouldFallbackWithoutCompassColumns(errorNoStateNoAssistantMessageId)) {
        if (requestedCompass) {
          return { ok: false, error: errorNoStateNoAssistantMessageId };
        }

        return await insertMessageAttempt({
          supabase,
          mode,
          payload: buildPayloadWithoutStateAndAssistantMessageId({
            userId,
            conversationId,
            role,
            content,
            lang,
          }),
        });
      }

      return { ok: false, error: errorNoStateNoAssistantMessageId };
    }

    return { ok: false, error: errorNoAssistantMessageId };
  }

  if (shouldFallbackWithoutCompassColumns(error)) {
    if (requestedCompass) {
      return { ok: false, error };
    }

    const attemptNoCompass = await insertMessageAttempt({
      supabase,
      mode,
      payload: buildPayload({
        userId,
        conversationId,
        role,
        content,
        lang,
        state_level: optionalParams.state_level,
        current_phase: optionalParams.current_phase,
        state_changed: optionalParams.state_changed,
        prev_phase: optionalParams.prev_phase,
        prev_state_level: optionalParams.prev_state_level,
        assistant_message_id: optionalParams.assistant_message_id,
      }),
    });

    if (attemptNoCompass.ok) return attemptNoCompass;
    const errorNoCompass = attemptNoCompass.error;

    if (shouldFallbackWithoutAssistantMessageIdColumn(errorNoCompass)) {
      if (requestedAssistantIdentity) {
        return { ok: false, error: errorNoCompass };
      }

      const attemptNoCompassNoAssistantMessageId =
        await insertMessageAttempt({
          supabase,
          mode,
          payload: buildPayloadWithoutAssistantMessageId({
            userId,
            conversationId,
            role,
            content,
            lang,
            state_level: optionalParams.state_level,
            current_phase: optionalParams.current_phase,
            state_changed: optionalParams.state_changed,
            prev_phase: optionalParams.prev_phase,
            prev_state_level: optionalParams.prev_state_level,
          }),
        });

      if (attemptNoCompassNoAssistantMessageId.ok) {
        return attemptNoCompassNoAssistantMessageId;
      }
      const errorNoCompassNoAssistantMessageId =
        attemptNoCompassNoAssistantMessageId.error;

      if (shouldFallbackToThreadIdColumn(errorNoCompassNoAssistantMessageId)) {
        const attemptThreadNoCompassNoAssistantMessageId =
          await insertMessageAttempt({
            supabase,
            mode,
            payload: buildPayloadFallbackThreadIdWithoutAssistantMessageId({
              userId,
              conversationId,
              role,
              content,
              lang,
              state_level: optionalParams.state_level,
              current_phase: optionalParams.current_phase,
              state_changed: optionalParams.state_changed,
              prev_phase: optionalParams.prev_phase,
              prev_state_level: optionalParams.prev_state_level,
            }),
          });

        if (attemptThreadNoCompassNoAssistantMessageId.ok) {
          return attemptThreadNoCompassNoAssistantMessageId;
        }
        const errorThreadNoCompassNoAssistantMessageId =
          attemptThreadNoCompassNoAssistantMessageId.error;

        if (
          shouldFallbackWithoutStateColumns(
            errorThreadNoCompassNoAssistantMessageId,
          )
        ) {
          if (requestedState) {
            return {
              ok: false,
              error: errorThreadNoCompassNoAssistantMessageId,
            };
          }

          return await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
              }),
          });
        }

        return { ok: false, error: errorThreadNoCompassNoAssistantMessageId };
      }

      if (shouldFallbackWithoutStateColumns(errorNoCompassNoAssistantMessageId)) {
        if (requestedState) {
          return { ok: false, error: errorNoCompassNoAssistantMessageId };
        }

        return await insertMessageAttempt({
          supabase,
          mode,
          payload: buildPayloadWithoutStateAndAssistantMessageId({
            userId,
            conversationId,
            role,
            content,
            lang,
          }),
        });
      }

      return { ok: false, error: errorNoCompassNoAssistantMessageId };
    }

    if (shouldFallbackToThreadIdColumn(errorNoCompass)) {
      const attemptThreadNoCompass = await insertMessageAttempt({
        supabase,
        mode,
        payload: buildPayloadFallbackThreadId({
          userId,
          conversationId,
          role,
          content,
          lang,
          state_level: optionalParams.state_level,
          current_phase: optionalParams.current_phase,
          state_changed: optionalParams.state_changed,
          prev_phase: optionalParams.prev_phase,
          prev_state_level: optionalParams.prev_state_level,
          assistant_message_id: optionalParams.assistant_message_id,
        }),
      });

      if (attemptThreadNoCompass.ok) return attemptThreadNoCompass;
      const errorThreadNoCompass = attemptThreadNoCompass.error;

      if (shouldFallbackWithoutAssistantMessageIdColumn(errorThreadNoCompass)) {
        if (requestedAssistantIdentity) {
          return { ok: false, error: errorThreadNoCompass };
        }

        const attemptThreadNoCompassNoAssistantMessageId =
          await insertMessageAttempt({
            supabase,
            mode,
            payload: buildPayloadFallbackThreadIdWithoutAssistantMessageId({
              userId,
              conversationId,
              role,
              content,
              lang,
              state_level: optionalParams.state_level,
              current_phase: optionalParams.current_phase,
              state_changed: optionalParams.state_changed,
              prev_phase: optionalParams.prev_phase,
              prev_state_level: optionalParams.prev_state_level,
            }),
          });

        if (attemptThreadNoCompassNoAssistantMessageId.ok) {
          return attemptThreadNoCompassNoAssistantMessageId;
        }
        const errorThreadNoCompassNoAssistantMessageId =
          attemptThreadNoCompassNoAssistantMessageId.error;

        if (
          shouldFallbackWithoutStateColumns(
            errorThreadNoCompassNoAssistantMessageId,
          )
        ) {
          if (requestedState) {
            return {
              ok: false,
              error: errorThreadNoCompassNoAssistantMessageId,
            };
          }

          return await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
              }),
          });
        }

        return { ok: false, error: errorThreadNoCompassNoAssistantMessageId };
      }

      if (shouldFallbackWithoutStateColumns(errorThreadNoCompass)) {
        if (requestedState) {
          return { ok: false, error: errorThreadNoCompass };
        }

        return await insertMessageAttempt({
          supabase,
          mode,
          payload: buildPayloadFallbackThreadIdWithoutState({
            userId,
            conversationId,
            role,
            content,
            lang,
            assistant_message_id: optionalParams.assistant_message_id,
          }),
        });
      }

      return { ok: false, error: errorThreadNoCompass };
    }

    if (shouldFallbackWithoutStateColumns(errorNoCompass)) {
      if (requestedState) {
        return { ok: false, error: errorNoCompass };
      }

      return await insertMessageAttempt({
        supabase,
        mode,
        payload: buildPayloadWithoutState({
          userId,
          conversationId,
          role,
          content,
          lang,
          assistant_message_id: optionalParams.assistant_message_id,
        }),
      });
    }

    return { ok: false, error: errorNoCompass };
  }

  if (shouldFallbackToThreadIdColumn(error)) {
    const attemptThread = await insertMessageAttempt({
      supabase,
      mode,
      payload: buildPayloadFallbackThreadId({
        userId,
        conversationId,
        role,
        content,
        lang,
        ...optionalParams,
      }),
    });

    if (attemptThread.ok) return attemptThread;
    const errorThread = attemptThread.error;

    if (shouldFallbackWithoutAssistantMessageIdColumn(errorThread)) {
      if (requestedAssistantIdentity) {
        return { ok: false, error: errorThread };
      }

      const attemptThreadNoAssistantMessageId = await insertMessageAttempt({
        supabase,
        mode,
        payload: buildPayloadFallbackThreadIdWithoutAssistantMessageId({
          userId,
          conversationId,
          role,
          content,
          lang,
          state_level: optionalParams.state_level,
          current_phase: optionalParams.current_phase,
          state_changed: optionalParams.state_changed,
          prev_phase: optionalParams.prev_phase,
          prev_state_level: optionalParams.prev_state_level,
          compass_text: optionalParams.compass_text,
          compass_prompt: optionalParams.compass_prompt,
        }),
      });

      if (attemptThreadNoAssistantMessageId.ok) {
        return attemptThreadNoAssistantMessageId;
      }
      const errorThreadNoAssistantMessageId =
        attemptThreadNoAssistantMessageId.error;

      if (shouldFallbackWithoutCompassColumns(errorThreadNoAssistantMessageId)) {
        if (requestedCompass) {
          return { ok: false, error: errorThreadNoAssistantMessageId };
        }

        const attemptThreadNoAssistantMessageIdNoCompass =
          await insertMessageAttempt({
            supabase,
            mode,
            payload: buildPayloadFallbackThreadIdWithoutAssistantMessageId({
              userId,
              conversationId,
              role,
              content,
              lang,
              state_level: optionalParams.state_level,
              current_phase: optionalParams.current_phase,
              state_changed: optionalParams.state_changed,
              prev_phase: optionalParams.prev_phase,
              prev_state_level: optionalParams.prev_state_level,
            }),
          });

        if (attemptThreadNoAssistantMessageIdNoCompass.ok) {
          return attemptThreadNoAssistantMessageIdNoCompass;
        }
        const errorThreadNoAssistantMessageIdNoCompass =
          attemptThreadNoAssistantMessageIdNoCompass.error;

        if (
          shouldFallbackWithoutStateColumns(
            errorThreadNoAssistantMessageIdNoCompass,
          )
        ) {
          if (requestedState) {
            return {
              ok: false,
              error: errorThreadNoAssistantMessageIdNoCompass,
            };
          }

          return await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
              }),
          });
        }

        return { ok: false, error: errorThreadNoAssistantMessageIdNoCompass };
      }

      if (shouldFallbackWithoutStateColumns(errorThreadNoAssistantMessageId)) {
        if (requestedState) {
          return { ok: false, error: errorThreadNoAssistantMessageId };
        }

        const attemptThreadNoStateNoAssistantMessageId =
          await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
                compass_text: optionalParams.compass_text,
                compass_prompt: optionalParams.compass_prompt,
              }),
          });

        if (attemptThreadNoStateNoAssistantMessageId.ok) {
          return attemptThreadNoStateNoAssistantMessageId;
        }
        const errorThreadNoStateNoAssistantMessageId =
          attemptThreadNoStateNoAssistantMessageId.error;

        if (
          shouldFallbackWithoutCompassColumns(
            errorThreadNoStateNoAssistantMessageId,
          )
        ) {
          if (requestedCompass) {
            return { ok: false, error: errorThreadNoStateNoAssistantMessageId };
          }

          return await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
              }),
          });
        }

        return { ok: false, error: errorThreadNoStateNoAssistantMessageId };
      }

      return { ok: false, error: errorThreadNoAssistantMessageId };
    }

    if (shouldFallbackWithoutCompassColumns(errorThread)) {
      if (requestedCompass) {
        return { ok: false, error: errorThread };
      }

      const attemptThreadNoCompass = await insertMessageAttempt({
        supabase,
        mode,
        payload: buildPayloadFallbackThreadId({
          userId,
          conversationId,
          role,
          content,
          lang,
          state_level: optionalParams.state_level,
          current_phase: optionalParams.current_phase,
          state_changed: optionalParams.state_changed,
          prev_phase: optionalParams.prev_phase,
          prev_state_level: optionalParams.prev_state_level,
          assistant_message_id: optionalParams.assistant_message_id,
        }),
      });

      if (attemptThreadNoCompass.ok) return attemptThreadNoCompass;
      const errorThreadNoCompass = attemptThreadNoCompass.error;

      if (shouldFallbackWithoutAssistantMessageIdColumn(errorThreadNoCompass)) {
        if (requestedAssistantIdentity) {
          return { ok: false, error: errorThreadNoCompass };
        }

        const attemptThreadNoCompassNoAssistantMessageId =
          await insertMessageAttempt({
            supabase,
            mode,
            payload: buildPayloadFallbackThreadIdWithoutAssistantMessageId({
              userId,
              conversationId,
              role,
              content,
              lang,
              state_level: optionalParams.state_level,
              current_phase: optionalParams.current_phase,
              state_changed: optionalParams.state_changed,
              prev_phase: optionalParams.prev_phase,
              prev_state_level: optionalParams.prev_state_level,
            }),
          });

        if (attemptThreadNoCompassNoAssistantMessageId.ok) {
          return attemptThreadNoCompassNoAssistantMessageId;
        }
        const errorThreadNoCompassNoAssistantMessageId =
          attemptThreadNoCompassNoAssistantMessageId.error;

        if (
          shouldFallbackWithoutStateColumns(
            errorThreadNoCompassNoAssistantMessageId,
          )
        ) {
          if (requestedState) {
            return {
              ok: false,
              error: errorThreadNoCompassNoAssistantMessageId,
            };
          }

          return await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
              }),
          });
        }

        return { ok: false, error: errorThreadNoCompassNoAssistantMessageId };
      }

      if (shouldFallbackWithoutStateColumns(errorThreadNoCompass)) {
        if (requestedState) {
          return { ok: false, error: errorThreadNoCompass };
        }

        return await insertMessageAttempt({
          supabase,
          mode,
          payload: buildPayloadFallbackThreadIdWithoutState({
            userId,
            conversationId,
            role,
            content,
            lang,
            assistant_message_id: optionalParams.assistant_message_id,
          }),
        });
      }

      return { ok: false, error: errorThreadNoCompass };
    }

    if (shouldFallbackWithoutStateColumns(errorThread)) {
      if (requestedState) {
        return { ok: false, error: errorThread };
      }

      const attemptThreadNoState = await insertMessageAttempt({
        supabase,
        mode,
        payload: buildPayloadFallbackThreadIdWithoutState({
          userId,
          conversationId,
          role,
          content,
          lang,
          compass_text: optionalParams.compass_text,
          compass_prompt: optionalParams.compass_prompt,
          assistant_message_id: optionalParams.assistant_message_id,
        }),
      });

      if (attemptThreadNoState.ok) return attemptThreadNoState;
      const errorThreadNoState = attemptThreadNoState.error;

      if (shouldFallbackWithoutAssistantMessageIdColumn(errorThreadNoState)) {
        if (requestedAssistantIdentity) {
          return { ok: false, error: errorThreadNoState };
        }

        const attemptThreadNoStateNoAssistantMessageId =
          await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
                compass_text: optionalParams.compass_text,
                compass_prompt: optionalParams.compass_prompt,
              }),
          });

        if (attemptThreadNoStateNoAssistantMessageId.ok) {
          return attemptThreadNoStateNoAssistantMessageId;
        }
        const errorThreadNoStateNoAssistantMessageId =
          attemptThreadNoStateNoAssistantMessageId.error;

        if (
          shouldFallbackWithoutCompassColumns(
            errorThreadNoStateNoAssistantMessageId,
          )
        ) {
          if (requestedCompass) {
            return { ok: false, error: errorThreadNoStateNoAssistantMessageId };
          }

          return await insertMessageAttempt({
            supabase,
            mode,
            payload:
              buildPayloadFallbackThreadIdWithoutStateAndAssistantMessageId({
                userId,
                conversationId,
                role,
                content,
                lang,
              }),
          });
        }

        return { ok: false, error: errorThreadNoStateNoAssistantMessageId };
      }

      if (shouldFallbackWithoutCompassColumns(errorThreadNoState)) {
        if (requestedCompass) {
          return { ok: false, error: errorThreadNoState };
        }

        return await insertMessageAttempt({
          supabase,
          mode,
          payload: buildPayloadFallbackThreadIdWithoutState({
            userId,
            conversationId,
            role,
            content,
            lang,
            assistant_message_id: optionalParams.assistant_message_id,
          }),
        });
      }

      return { ok: false, error: errorThreadNoState };
    }

    return { ok: false, error: errorThread };
  }

  if (shouldFallbackWithoutStateColumns(error)) {
    if (requestedState) {
      return { ok: false, error };
    }

    const attemptNoState = await insertMessageAttempt({
      supabase,
      mode,
      payload: buildPayloadWithoutState({
        userId,
        conversationId,
        role,
        content,
        lang,
        compass_text: optionalParams.compass_text,
        compass_prompt: optionalParams.compass_prompt,
        assistant_message_id: optionalParams.assistant_message_id,
      }),
    });

    if (attemptNoState.ok) return attemptNoState;
    const errorNoState = attemptNoState.error;

    if (shouldFallbackWithoutAssistantMessageIdColumn(errorNoState)) {
      if (requestedAssistantIdentity) {
        return { ok: false, error: errorNoState };
      }

      const attemptNoStateNoAssistantMessageId = await insertMessageAttempt({
        supabase,
        mode,
        payload: buildPayloadWithoutStateAndAssistantMessageId({
          userId,
          conversationId,
          role,
          content,
          lang,
          compass_text: optionalParams.compass_text,
          compass_prompt: optionalParams.compass_prompt,
        }),
      });

      if (attemptNoStateNoAssistantMessageId.ok) {
        return attemptNoStateNoAssistantMessageId;
      }
      const errorNoStateNoAssistantMessageId =
        attemptNoStateNoAssistantMessageId.error;

      if (shouldFallbackWithoutCompassColumns(errorNoStateNoAssistantMessageId)) {
        if (requestedCompass) {
          return { ok: false, error: errorNoStateNoAssistantMessageId };
        }

        return await insertMessageAttempt({
          supabase,
          mode,
          payload: buildPayloadWithoutStateAndAssistantMessageId({
            userId,
            conversationId,
            role,
            content,
            lang,
          }),
        });
      }

      return { ok: false, error: errorNoStateNoAssistantMessageId };
    }

    if (shouldFallbackWithoutCompassColumns(errorNoState)) {
      if (requestedCompass) {
        return { ok: false, error: errorNoState };
      }

      return await insertMessageAttempt({
        supabase,
        mode,
        payload: buildPayloadWithoutState({
          userId,
          conversationId,
          role,
          content,
          lang,
          assistant_message_id: optionalParams.assistant_message_id,
        }),
      });
    }

    return { ok: false, error: errorNoState };
  }

  return { ok: false, error };
}

/*
このファイルの正式役割
messages 保存時の共通 insert 実行責務を持つ分離ファイル。
RETURNINGあり/なし、conversation_id / thread_id、state列欠落、compass列欠落、
assistant_message_id 列欠落のフォールバック順を一か所で固定する。
保存層では HOPY回答確定時の state / compass / assistant_message_id を
再判定・再生成しない。
*/

/*
【今回このファイルで修正したこと】
- assistant_message_id を保存項目として受け取れるように追加した。
- messages insert payload に assistant_message_id をそのまま載せる責務を追加した。
- assistant_message_id 列欠落時のフォールバック判定を追加した。
- requested assistant_message_id がある場合は、state / compass と同様に勝手に欠落させずエラーで止めるようにした。
*/