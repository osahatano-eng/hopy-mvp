// /components/chat/view/chatStreamViewItems.ts
"use client";

import type { Lang } from "../lib/chatTypes";
import type { ChatMsg } from "../lib/chatTypes";
import {
  resolveAssistantDotMeta,
  type AssistantDotMeta,
} from "./chatStreamAssistantState";
import {
  buildChatStreamFutureChainItem,
  type ChatStreamFutureChainViewItem,
} from "./chatStreamFutureChainItem";

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
    }
  | ChatStreamFutureChainViewItem;

function normalizeCompassString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function normalizeBooleanOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "1") return true;
    if (s === "0") return false;
  }

  return null;
}

function readMessageRole(msg: ChatMsg): "user" | "assistant" | null {
  const source = msg as {
    role?: unknown;
    sender?: unknown;
    author?: unknown;
  };

  const raw = String(source.role ?? source.sender ?? source.author ?? "")
    .trim()
    .toLowerCase();

  if (raw === "user" || raw === "assistant") return raw;
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
      ui_effects?: {
        compass?: {
          text?: unknown;
          prompt?: unknown;
        } | null;
      } | null;
      uiEffects?: {
        compass?: {
          text?: unknown;
          prompt?: unknown;
        } | null;
      } | null;
    } | null;
  };

  const text = normalizeCompassString(
    source.hopy_confirmed_payload?.ui_effects?.compass?.text ??
      source.hopy_confirmed_payload?.uiEffects?.compass?.text ??
      source.hopy_confirmed_payload?.compass?.text,
  );
  const prompt = normalizeCompassString(
    source.hopy_confirmed_payload?.ui_effects?.compass?.prompt ??
      source.hopy_confirmed_payload?.uiEffects?.compass?.prompt ??
      source.hopy_confirmed_payload?.compass?.prompt,
  );

  if (!text) return null;

  return {
    text,
    prompt,
  };
}

function readMessageDisplayText(msg: ChatMsg): string {
  const source = msg as {
    content?: unknown;
    text?: unknown;
    body?: unknown;
    message?: unknown;
    prompt?: unknown;
    reply?: unknown;
  };

  const candidates = [
    source.content,
    source.text,
    source.body,
    source.message,
    source.prompt,
    source.reply,
  ];

  for (const value of candidates) {
    if (typeof value !== "string") continue;
    if (value.trim().length === 0) continue;
    return value;
  }

  return "";
}

function readVisibleTextFromArray(
  visibleTexts: string[],
  messageIndex: number,
): string | undefined {
  const value = visibleTexts[messageIndex];
  return typeof value === "string" ? value : undefined;
}

function readVisibleTextFromMap(
  visibleTexts: Map<string, string>,
  msgKey: string,
): string | undefined {
  const value = visibleTexts.get(msgKey);
  return typeof value === "string" ? value : undefined;
}

export function getChatStreamViewItems(args: {
  rendered: RenderItem[];
  visibleTexts: Map<string, string> | string[];
  uiLang: Lang;
}): ViewItem[] {
  const { rendered, visibleTexts, uiLang } = args;

  if (rendered.length === 0) return [];

  const tempItems: ViewItem[] = [];
  let messageIndex = 0;

  for (let i = 0; i < rendered.length; i++) {
    const it = rendered[i];

    if (it.kind === "divider") {
      tempItems.push({ kind: "divider", key: it.key, label: it.label });
      continue;
    }

    const role = readMessageRole(it.msg);
    const msgKey = it.msgKey;
    const fallbackText = readMessageDisplayText(it.msg);

    const visibleText =
      visibleTexts instanceof Map
        ? readVisibleTextFromMap(visibleTexts, msgKey)
        : Array.isArray(visibleTexts)
          ? readVisibleTextFromArray(visibleTexts, messageIndex)
          : undefined;

    messageIndex += 1;

    const text =
      typeof visibleText === "string" && visibleText.trim().length > 0
        ? visibleText
        : fallbackText;

    if (!role) continue;
    if (text.trim().length === 0) continue;

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

      const futureChainItem = buildChatStreamFutureChainItem({
        msg: it.msg,
        msgKey,
        key: it.key,
        plan: "free",
      });

      if (futureChainItem) {
        tempItems.push(futureChainItem);
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
msg / divider / compass / future_chain の表示用データを組み立てる。

このファイルが受け取るもの
rendered
visibleTexts
uiLang

このファイルが渡すもの
ViewItem[]
- divider
- msg
- compass
- future_chain

Compass 観点でこのファイルの意味
このファイルは、assistant message から Compass 情報を読み取り、
ChatStreamCompass.tsx が描画できる kind: "compass" の ViewItem を作る場所。
表示用の Compass item を生成するクライアント側の入口である。

Future Chain 観点でこのファイルの意味
このファイルは、assistant message から Future Chain 表示用 item を追加する接続場所。
Future Chain の詳細判定は chatStreamFutureChainItem.ts に任せる。
このファイルでは future_chain_context の意味生成、HOPY回答再要約、Compass再要約、
state_changed再判定、DB保存、recipient_support検索、delivery_event保存をしない。

このファイルで確認できた大事なこと
1. assistant message のときだけ readCompassFromMessage(...) を呼ぶ。
2. Compass は hopy_confirmed_payload.ui_effects.compass / uiEffects.compass / compass から読む。
3. Compass は hopy_confirmed_payload.state.state_changed === true かつ compass.text があるときだけ ViewItem に載せる。
4. ChatStreamCompass.tsx は kind: "compass" の item しか表示しない。
5. このファイルでは fallback Compass 文言を生成しない。
6. Future Chain item は buildChatStreamFutureChainItem(...) に任せる。
*/

 /*
【今回このファイルで修正したこと】
- ViewItem に ChatStreamFutureChainViewItem を追加しました。
- assistant message のとき、buildChatStreamFutureChainItem(...) を呼び、返った場合だけ tempItems に追加するようにしました。
- Future Chain の中身判定は chatStreamFutureChainItem.ts に分離し、このファイルには直書きしていません。
- 現時点では plan を "free" 固定で渡しています。Plus / Pro のUI接続は未実装です。
- role 正規化、本文フォールバック、Compass の唯一の正には触っていません。
- HOPY回答○、Compass、DB保存、DB復元の意味判定には触っていません。
*/

/* /components/chat/view/chatStreamViewItems.ts */