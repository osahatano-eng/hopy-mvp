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
  futureChainPersist: _futureChainPersist,
}: ChatFutureChainNoticeProps) {
  return null;
}

/*
【このファイルの正式役割】
旧 Future Chain v2 の保存成功通知UIを受け止める互換コンポーネント。
v3では Future Chain の本表示位置をこのファイルに持たせない。
owner_handoff は Compass下、recipient_support は HOPY回答下に表示する方針のため、
このファイルでは旧 notice を表示せず null を返す。

このファイルは Future Chain の保存可否、state_changed、state_level、Compass、HOPY回答○、
DB取得、payload生成、表示payload生成、recipient_support検索を再判定しない。

【今回このファイルで修正したこと】
- v2の保存成功通知UIを表示しないようにしました。
- futureChainPersist を受け取る互換propsは残し、ChatClientView 側の既存importを壊さない形にしました。
- 入力欄上・本文最下部に出ていた旧 FUTURE CHAIN notice を止めました。
- v3本来の owner_handoff / recipient_support 表示はまだこのファイルには実装していません。
- HOPY唯一の正、state_changed、Compass、HOPY回答○、Future Chain保存処理、DB、MEMORIES、DASHBOARDには触れていません。

/components/chat/view/ChatFutureChainNotice.tsx
*/