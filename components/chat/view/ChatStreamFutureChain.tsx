// /components/chat/view/ChatStreamFutureChain.tsx
"use client";

import React from "react";
import type { ChatStreamFutureChainViewItem } from "./chatStreamFutureChainItem";

type Props = {
  item: ChatStreamFutureChainViewItem;
};

function ChatStreamFutureChainInner({ item }: Props) {
  if (item.kind !== "future_chain") return null;

  const isMinimal = item.detailLevel === "minimal";
  const isRecipientSupport = item.mode === "recipient_support";

  const snapshotLabel = isRecipientSupport
    ? "過去から届いたHOPYの言葉"
    : "HOPY回答からFuture Chainに保存する言葉";

  const snapshotDescription = isRecipientSupport
    ? "この文言が、過去の本物の会話から今のあなたへ届いています。"
    : "この文言が、今回のHOPY回答から切り出され、匿名化された形で未来の誰かへ渡されます。";

  return (
    <section
      aria-label="Future Chain"
      data-future-chain=""
      data-future-chain-mode={item.mode}
      data-future-chain-placement={item.placement}
      style={{
        marginTop: "12px",
        marginBottom: "2px",
        borderRadius: "18px",
        border: "1px solid rgba(203, 213, 225, 0.72)",
        background: "rgba(255, 255, 255, 0.72)",
        padding: "14px 16px",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
        color: "rgb(51, 65, 85)",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "6px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "11px",
            lineHeight: 1.4,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "rgba(100, 116, 139, 0.74)",
            textTransform: "uppercase",
          }}
        >
          Future Chain
        </p>

        <p
          style={{
            margin: 0,
            fontSize: "14px",
            lineHeight: 1.65,
            fontWeight: 700,
            color: "rgb(30, 41, 59)",
          }}
        >
          {item.title}
        </p>

        <p
          style={{
            margin: 0,
            fontSize: "14px",
            lineHeight: 1.75,
            color: "rgb(71, 85, 105)",
          }}
        >
          {item.description}
        </p>
      </div>

      {isMinimal ? (
        <div
          style={{
            display: "grid",
            gap: "6px",
            marginTop: "12px",
            borderRadius: "14px",
            background: "rgba(248, 250, 252, 0.82)",
            padding: "12px 13px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              lineHeight: 1.5,
              fontWeight: 700,
              color: "rgba(51, 65, 85, 0.82)",
            }}
          >
            未来へ待機中
          </p>

          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.7,
              color: "rgb(100, 116, 139)",
            }}
          >
            このHOPYの言葉は、匿名化された形で未来の誰かの支えになる可能性があります。
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "8px",
            marginTop: "14px",
            borderRadius: "14px",
            background: "rgba(248, 250, 252, 0.82)",
            padding: "12px 13px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              lineHeight: 1.5,
              fontWeight: 700,
              color: "rgba(51, 65, 85, 0.82)",
            }}
          >
            {snapshotLabel}
          </p>

          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.75,
              color: "rgb(100, 116, 139)",
            }}
          >
            {snapshotDescription}
          </p>

          <blockquote
            style={{
              margin: "2px 0 0",
              padding: "10px 12px",
              borderLeft: "3px solid rgba(100, 116, 139, 0.28)",
              borderRadius: "12px",
              background: "rgba(255, 255, 255, 0.64)",
              fontSize: "14px",
              lineHeight: 1.8,
              color: "rgb(51, 65, 85)",
              whiteSpace: "pre-wrap",
            }}
          >
            {item.handoffMessageSnapshot}
          </blockquote>
        </div>
      )}
    </section>
  );
}

const ChatStreamFutureChain = React.memo(ChatStreamFutureChainInner);

export default ChatStreamFutureChain;

/*
【このファイルの正式役割】
HOPY Future Chain v3.1 のチャットストリーム表示専用ファイル。
kind: "future_chain" の ViewItem を受け取り、Future Chain カードとして描画する。
v3.1では、旧v3の4項目ではなく、
handoffMessageSnapshot を主役として表示する。

このファイルは HOPY回答再要約、Compass再要約、Future Chain意味生成、
state_changed再判定、state_level再判定、current_phase再判定、
Compass表示可否判定、HOPY回答○判定、DB保存、recipient_support検索、
delivery_event保存、Future Chainページ集計を担当しない。

【今回このファイルで修正したこと】
- item.mode を見て owner_handoff と recipient_support の表示文言を描き分けるようにした。
- owner_handoff では handoffMessageSnapshot を「HOPY回答からFuture Chainに保存する言葉」として表示するようにした。
- recipient_support では handoffMessageSnapshot を「過去から届いたHOPYの言葉」として表示するようにした。
- full 表示で、固定文だけではなく item.handoffMessageSnapshot 自体を主役として表示する構造は維持した。
- minimal / full の分岐、detailLevel、handoffMessageSnapshot の表示条件は変更していない。
- HOPY回答全文、Compass全文、ユーザー発話生文を読む処理は入れていない。
- plan判定、recipient_support検索、delivery_event保存、Future Chainページには触れていない。

/components/chat/view/ChatStreamFutureChain.tsx
*/