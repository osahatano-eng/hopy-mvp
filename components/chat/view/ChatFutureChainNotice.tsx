// /components/chat/view/ChatFutureChainNotice.tsx

export type ChatFutureChainPersist = {
  ok?: boolean;
  decision?: string | null;
  reason?: string | null;
  patternId?: string | null;
};

export type ChatFutureChainNoticeProps = {
  futureChainPersist?: ChatFutureChainPersist | null;
};

export function ChatFutureChainNotice({
  futureChainPersist,
}: ChatFutureChainNoticeProps) {
  const shouldShow =
    futureChainPersist?.ok === true &&
    futureChainPersist.decision === "save" &&
    Boolean(futureChainPersist.patternId);

  if (!shouldShow) {
    return null;
  }

  return (
    <section
      aria-label="Future Chain"
      className="mt-3 rounded-2xl border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm"
    >
      <p className="text-xs font-medium tracking-[0.08em] text-slate-400">
        FUTURE CHAIN
      </p>
      <p className="mt-1 font-medium text-slate-800">
        未来の誰かへ、支えとして残しました。
      </p>
      <p className="mt-1 leading-relaxed text-slate-600">
        この前進は、会話本文や個人情報ではなく、抽象化された支援パターンとして保存されています。
      </p>
    </section>
  );
}

/*
【このファイルの正式役割】
Future Chain の保存結果を受け取り、保存成功時だけ小さな通知UIとして表示する描画専用コンポーネント。
このファイルは Future Chain の保存可否、state_changed、state_level、Compass、HOPY回答○、DB取得、payload生成を再判定しない。
受け取った futureChainPersist の結果をもとに、decision が save の場合だけ表示する。

【今回このファイルで修正したこと】
- Future Chain 保存成功時に表示するための新規UIコンポーネントを作成した。
- skip / failed / null の場合は何も表示しないようにした。
- ChatClientView 側を重くしないため、表示責務を新規ファイルへ分離した。
- HOPY唯一の正、state_changed、Compass、HOPY回答○、Future Chain保存処理、DB、MEMORIES、DASHBOARDには触れていない。

/components/chat/view/ChatFutureChainNotice.tsx
*/