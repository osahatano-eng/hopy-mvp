// /components/chat/view/chatStreamViewItems.ts
"use client";

import type { Lang } from "../lib/chatTypes";
import type { ChatMsg } from "../lib/chatTypes";
import {
  resolveAssistantDotMeta,
  type AssistantDotMeta,
} from "./chatStreamAssistantState";

export type RenderItem =
  | { kind: "divider"; key: string; label: string }
  | { kind: "msg"; key: string; msg: ChatMsg; msgKey: string };

export type ViewItem =
  | { kind: "divider"; key: string; label: string }
  | {
      kind: "msg";
      key: string;
      role: "user" | "assistant" | (string & {});
      msgKey: string;
      text: string;
      isLastUser: boolean;
      assistantDot: AssistantDotMeta | null;
      msg: ChatMsg;
    }
  | {
      kind: "compass";
      key: string;
      msgKey: string;
      text: string;
      prompt: string | null;
      msg: ChatMsg;
    };

function normalizeCompassString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function normalizeBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }

  return null;
}

function readConfirmedStateChangedFromMessage(msg: ChatMsg): boolean | null {
  const source = msg as {
    hopy_confirmed_payload?: {
      state?: {
        state_changed?: unknown;
      } | null;
    } | null;
  };

  return normalizeBooleanOrNull(
    source.hopy_confirmed_payload?.state?.state_changed,
  );
}

function readCompassFromMessage(
  msg: ChatMsg,
): { text: string; prompt: string | null } | null {
  const source = msg as {
    hopy_confirmed_payload?: {
      compass?: {
        text?: unknown;
        prompt?: unknown;
      } | null;
    } | null;
  };

  const text = normalizeCompassString(
    source.hopy_confirmed_payload?.compass?.text,
  );
  const prompt = normalizeCompassString(
    source.hopy_confirmed_payload?.compass?.prompt,
  );

  if (!text) return null;

  return {
    text,
    prompt,
  };
}

export function getChatStreamViewItems(args: {
  rendered: RenderItem[];
  visibleTexts: Map<string, string>;
  uiLang: Lang;
}): ViewItem[] {
  const { rendered, visibleTexts, uiLang } = args;

  if (rendered.length === 0) return [];

  const tempItems: ViewItem[] = [];

  for (let i = 0; i < rendered.length; i++) {
    const it = rendered[i];

    if (it.kind === "divider") {
      tempItems.push({ kind: "divider", key: it.key, label: it.label });
      continue;
    }

    const role = it.msg.role as "user" | "assistant" | (string & {});
    const msgKey = it.msgKey;
    const fallbackText = String(it.msg.content ?? "");
    const text = visibleTexts.get(msgKey) ?? fallbackText;

    let assistantDot: AssistantDotMeta | null = null;

    if (role === "assistant") {
      assistantDot = resolveAssistantDotMeta(it.msg, uiLang);
    }

    tempItems.push({
      kind: "msg",
      key: it.key,
      role,
      msgKey,
      text,
      isLastUser: false,
      assistantDot,
      msg: it.msg,
    });

    if (role === "assistant") {
      const confirmedStateChanged = readConfirmedStateChangedFromMessage(it.msg);
      const confirmedCompass = readCompassFromMessage(it.msg);

      if (confirmedStateChanged === true && confirmedCompass) {
        tempItems.push({
          kind: "compass",
          key: `${it.key}::compass`,
          msgKey,
          text: confirmedCompass.text,
          prompt: confirmedCompass.prompt,
          msg: it.msg,
        });
      }
    }
  }

  let lastUserMsgKey: string | null = null;
  for (let i = tempItems.length - 1; i >= 0; i--) {
    const it = tempItems[i];
    if (it.kind !== "msg") continue;
    if (it.role === "user") {
      lastUserMsgKey = it.msgKey;
      break;
    }
  }

  return tempItems.map((it) => {
    if (it.kind !== "msg") return it;
    return {
      ...it,
      isLastUser: it.role === "user" && it.msgKey === lastUserMsgKey,
    };
  });
}

/*
このファイルの正式役割
チャット表示用の ViewItem 生成ファイル。
rendered と visibleTexts から、
msg / divider / compass の表示用データを組み立てる。

このファイルが受け取るもの
rendered
visibleTexts
uiLang

このファイルが渡すもの
ViewItem[]
- divider
- msg
- compass

Compass 観点でこのファイルの意味
このファイルは、assistant message から Compass 情報を読み取り、
ChatStreamCompass.tsx が描画できる kind: "compass" の ViewItem を作る場所。
表示用の Compass item を生成するクライアント側の入口である。

このファイルで確認できた大事なこと
1. assistant message のときだけ readCompassFromMessage(...) を呼ぶ。
2. Compass は hopy_confirmed_payload.compass だけから読む。
3. Compass は hopy_confirmed_payload.state.state_changed === true かつ compass.text があるときだけ ViewItem に載せる。
4. ChatStreamCompass.tsx は kind: "compass" の item しか表示しない。
5. このファイルでは fallback Compass 文言を生成しない。
*/

// このファイルの正式役割: チャット表示用の ViewItem 生成ファイル

/*
このファイルの正式役割
チャット表示用の ViewItem 生成ファイル。
rendered と visibleTexts から、
msg / divider / compass の表示用データを組み立てる。
*/

/*
【今回このファイルで修正したこと】
- Compass item 生成条件から compass.prompt 必須条件を外した。
- hopy_confirmed_payload.state.state_changed === true かつ compass.text がある回だけを、UI 表示対象の Compass として通す形に戻した。
- prompt は表示条件に使わず、そのまま nullable で中継するだけにした。
*/