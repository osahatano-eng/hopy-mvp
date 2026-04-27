// /components/chat/view/ChatFutureChainNotice.tsx

export type ChatFutureChainPersist = {
  ok?: boolean;
  decision?: string | null;
  reason?: string | null;
  patternId?: string | null;
};

export type ChatFutureChainDisplay = {
  kind?: "owner_handoff" | "recipient_support" | "none" | string | null;
  shouldDisplay?: boolean | null;
  plan?: "free" | "plus" | "pro" | string | null;
  placement?: "below_reply" | "below_compass" | "none" | string | null;
  detailLevel?: "minimal" | "full" | "none" | string | null;
  title?: string | null;
  description?: string | null;
  handoffMessageSnapshot?: string | null;
  bridgeEventId?: string | null;
  deliveryEventId?: string | null;
};

export type ChatFutureChainNoticeProps = {
  futureChainPersist?: ChatFutureChainPersist | null;
  futureChainDisplay?: ChatFutureChainDisplay | null;
};

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function shouldShowFutureChainDisplay(
  futureChainDisplay: ChatFutureChainDisplay | null | undefined,
): futureChainDisplay is ChatFutureChainDisplay {
  if (!futureChainDisplay) return false;
  if (futureChainDisplay.shouldDisplay !== true) return false;
  if (futureChainDisplay.kind === "none") return false;

  return normalizeText(futureChainDisplay.handoffMessageSnapshot).length > 0;
}

function resolveFallbackTitle(kind: string | null | undefined): string {
  if (kind === "recipient_support") {
    return "過去のユーザーさんから Future Chain が届いています";
  }

  if (kind === "owner_handoff") {
    return "未来のユーザーさんへ Future Chain としてお渡しします";
  }

  return "Future Chain";
}

export function ChatFutureChainNotice({
  futureChainPersist: _futureChainPersist,
  futureChainDisplay,
}: ChatFutureChainNoticeProps) {
  if (!shouldShowFutureChainDisplay(futureChainDisplay)) {
    return null;
  }

  const title =
    normalizeText(futureChainDisplay.title) ||
    resolveFallbackTitle(futureChainDisplay.kind);

  const description = normalizeText(futureChainDisplay.description);
  const handoffMessageSnapshot = normalizeText(
    futureChainDisplay.handoffMessageSnapshot,
  );

  return (
    <section
      aria-label="Future Chain"
      style={{
        width: "min(100% - 32px, 760px)",
        margin: "12px auto 18px",
        padding: "14px 16px",
        borderRadius: 18,
        border: "1px solid rgba(120, 113, 108, 0.18)",
        background: "rgba(255, 255, 255, 0.72)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.08em",
            color: "rgba(87, 83, 78, 0.72)",
          }}
        >
          Future Chain
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.65,
            color: "rgba(41, 37, 36, 0.92)",
          }}
        >
          {title}
        </div>

        {description ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.75,
              color: "rgba(87, 83, 78, 0.82)",
            }}
          >
            {description}
          </p>
        ) : null}

        <blockquote
          style={{
            margin: "2px 0 0",
            padding: "10px 12px",
            borderLeft: "3px solid rgba(120, 113, 108, 0.28)",
            borderRadius: 12,
            background: "rgba(250, 250, 249, 0.78)",
            fontSize: 14,
            lineHeight: 1.8,
            color: "rgba(41, 37, 36, 0.9)",
          }}
        >
          {handoffMessageSnapshot}
        </blockquote>
      </div>
    </section>
  );
}

/*
【このファイルの正式役割】
Future Chain v3.1 の表示payloadを受け取り、チャット画面上に静かに表示する表示部品。
futureChainDisplay.shouldDisplay=true かつ handoffMessageSnapshot がある場合だけ表示する。
旧 Future Chain v2 の保存成功通知UIは表示せず、v3.1 の handoffMessageSnapshot を主役として扱う。

このファイルは Future Chain の保存可否、state_changed、state_level、Compass、HOPY回答○、
DB取得、payload生成、表示payload生成、recipient_support検索を再判定しない。

【今回このファイルで修正したこと】
- futureChainDisplay を props として受け取れるようにした。
- futureChainDisplay.shouldDisplay=true かつ handoffMessageSnapshot がある場合だけ表示するようにした。
- owner_handoff / recipient_support の title / description / handoffMessageSnapshot を表示するようにした。
- futureChainPersist を受け取る互換propsは残した。
- v2の保存成功通知UIは復活させていない。
- HOPY唯一の正、state_changed、Compass、HOPY回答○、Future Chain保存処理、DB、MEMORIES、DASHBOARDには触れていない。

/components/chat/view/ChatFutureChainNotice.tsx
*/