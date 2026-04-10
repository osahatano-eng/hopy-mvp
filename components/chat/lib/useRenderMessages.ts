// /components/chat/lib/useRenderMessages.ts
"use client";

import { useMemo, useRef } from "react";
import type { ChatMsg, Lang } from "./chatTypes";
import { formatDateLabel, toLocalDateKey } from "./dates";

/**
 * ✅ Invisible (zero-width) tone markers
 * - Do not show tags like [calm]/[growth]
 * - Still allow UI coloring by embedding non-visible markers into the rendered text.
 *
 * These sequences are composed only of zero-width characters (ZWSP/ZWNJ/ZWJ).
 * They should not be visible in UI.
 */
const TONE_MARKER = {
  calm: "\u200B\u200C\u200D",
  growth: "\u200B\u200D\u200C",
} as const;

type ToneKind = "calm" | "growth" | "none";

type MessageDerivedCache = {
  sig: string;
  rawTrim: string;
  base: string;
  tone: ToneKind;
  day: string;
  label: string;
};

type RenderedItem =
  | { kind: "divider"; key: string; label: string }
  | { kind: "msg"; key: string; msg: ChatMsg; msgKey: string };

function stripMetaTags(input: string) {
  const s = String(input ?? "");
  return s.replace(/\[(calm|stability|growth)\]\s*/gi, "").trim();
}

function detectToneByTagInRaw(raw: string): ToneKind {
  const t = String(raw ?? "").trim();
  if (!t) return "none";

  const hasCalmTag =
    /\[(calm|stability)\]/i.test(t) ||
    /#(calm|stability)\b/i.test(t) ||
    /（安定）/.test(t) ||
    /【安定】/.test(t) ||
    /＜安定＞/.test(t);

  const hasGrowthTag =
    /\[(growth)\]/i.test(t) ||
    /#growth\b/i.test(t) ||
    /（成長）/.test(t) ||
    /【成長】/.test(t) ||
    /＜成長＞/.test(t);

  if (hasCalmTag && !hasGrowthTag) return "calm";
  if (hasGrowthTag && !hasCalmTag) return "growth";
  return "none";
}

function withToneMarker(displayText: string, tone: ToneKind) {
  if (tone === "calm") return `${TONE_MARKER.calm}${displayText}`;
  if (tone === "growth") return `${TONE_MARKER.growth}${displayText}`;
  return displayText;
}

function resolveMsgKey(message: ChatMsg, index: number) {
  return message.id ?? `m-${index}`;
}

function createTranslatedTextReader(tmap: Map<string, string>, uiLang: Lang) {
  const canGet =
    tmap != null &&
    typeof tmap === "object" &&
    typeof (tmap as { get?: unknown }).get === "function";

  if (!canGet) {
    return (_base: string) => "";
  }

  const getter = (tmap as { get: (key: string) => string | undefined }).get.bind(
    tmap,
  );

  return (base: string) => {
    if (!base) return "";
    const translated = getter(`${uiLang}::${base}`);
    if (translated && translated.length > 0) {
      return stripMetaTags(translated);
    }
    return "";
  };
}

export function useRenderMessages(params: {
  messages: ChatMsg[];
  visibleCount: number;
  uiLang: Lang;
  dayStartLabel: string;
  tmap: Map<string, string>;
}) {
  const { messages, visibleCount, uiLang, dayStartLabel, tmap } = params;

  const derivedCacheRef = useRef<Map<string, MessageDerivedCache>>(new Map());

  const effectiveVisibleCount = useMemo(() => {
    const total = messages.length;
    if (total <= 0) return 0;

    const rawVisibleCount = Number.isFinite(visibleCount)
      ? Math.trunc(visibleCount)
      : total;

    if (rawVisibleCount <= 0) {
      return total;
    }

    if (rawVisibleCount === 1 && total >= 2) {
      return 2;
    }

    return rawVisibleCount;
  }, [messages.length, visibleCount]);

  const visibleMessages = useMemo(() => {
    const total = messages.length;
    if (effectiveVisibleCount >= total) return messages;
    const start = Math.max(0, total - effectiveVisibleCount);
    return messages.slice(start);
  }, [messages, effectiveVisibleCount]);

  const readTranslatedText = useMemo(() => {
    return createTranslatedTextReader(tmap, uiLang);
  }, [tmap, uiLang]);

  const { visibleTexts, rendered } = useMemo(() => {
    const nextVisibleTexts = new Map<string, string>();
    const nextRendered: RenderedItem[] = [];

    const liveKeys = new Set<string>();
    let prevDay = "";

    for (let i = 0; i < visibleMessages.length; i++) {
      const m = visibleMessages[i];
      const msgKey = resolveMsgKey(m, i);
      liveKeys.add(msgKey);

      const raw = typeof m.content === "string" ? m.content : String(m.content ?? "");
      const createdAt = String(m.created_at ?? "");
      const sig = `${m.role}__${m.lang}__${createdAt}__${raw}__${uiLang}__${dayStartLabel}`;

      const cached = derivedCacheRef.current.get(msgKey);

      let rawTrim = "";
      let base = "";
      let tone: ToneKind = "none";
      let day = "";
      let label = dayStartLabel;

      if (cached && cached.sig === sig) {
        rawTrim = cached.rawTrim;
        base = cached.base;
        tone = cached.tone;
        day = cached.day;
        label = cached.label;
      } else {
        rawTrim = raw.trim();
        base = rawTrim ? stripMetaTags(rawTrim) : "";
        tone = m.role === "assistant" ? detectToneByTagInRaw(rawTrim) : "none";
        day = toLocalDateKey(m.created_at);
        label = m.created_at ? formatDateLabel(m.created_at, uiLang) : dayStartLabel;

        derivedCacheRef.current.set(msgKey, {
          sig,
          rawTrim,
          base,
          tone,
          day,
          label,
        });
      }

      let out = base;

      if (base && m.lang !== uiLang) {
        const translated = readTranslatedText(base);
        if (translated) out = translated;
      }

      if (m.role === "assistant") {
        nextVisibleTexts.set(msgKey, withToneMarker(out, tone));
      } else {
        nextVisibleTexts.set(msgKey, out);
      }

      if (day !== prevDay) {
        nextRendered.push({ kind: "divider", key: `d-${day}-${i}`, label });
        prevDay = day;
      }

      nextRendered.push({ kind: "msg", key: msgKey, msg: m, msgKey });
    }

    if (derivedCacheRef.current.size > liveKeys.size * 2 + 50) {
      for (const key of derivedCacheRef.current.keys()) {
        if (!liveKeys.has(key)) {
          derivedCacheRef.current.delete(key);
        }
      }
    }

    return { visibleTexts: nextVisibleTexts, rendered: nextRendered };
  }, [visibleMessages, readTranslatedText, uiLang, dayStartLabel]);

  return { visibleMessages, visibleTexts, rendered };
}

/*
このファイルの正式役割
チャット本文メッセージ列を、画面描画用の rendered / visibleTexts に変換するファイル。
日付区切りと本文表示用テキストを組み立てる。

このファイルが受け取るもの
messages
visibleCount
uiLang
dayStartLabel
tmap

このファイルが渡すもの
visibleMessages
visibleTexts
rendered

Compass 観点でこのファイルの意味
このファイルは Compass を生成する場所ではない。
DB や上流から渡された message を、
画面描画のための基本的な rendered / visibleTexts へ変換する表示変換層である。
Compass の表示生成は後段の chatStreamViewItems.ts 側で行う。
*/

/*
【今回このファイルで修正したこと】
1. visibleCount をそのまま描画枚数の正にせず、effectiveVisibleCount を追加しました。
2. messages が存在するのに visibleCount <= 0 で本文が空へ落ちる経路を止めました。
3. visibleCount === 1 かつ messages が2件以上あるとき、直近2件を描画対象に残すようにしました。
4. これにより、送信直後の user message / pending assistant が visibleCount の追従遅れで落ちる経路を、このファイル内で止めました。
*/
/* /components/chat/lib/useRenderMessages.ts */