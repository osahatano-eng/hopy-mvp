// /app/api/chat/_lib/route/authenticatedPostTurnFailure.ts

type RunHopyTurnBuiltResult = Record<string, any>;

export type ResolveAuthenticatedPostTurnFailureParams = {
  openai_ok: boolean | null;
  openai_error: string | null;
  runTurnResult: RunHopyTurnBuiltResult | null | undefined;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function resolveAuthenticatedPostTurnFailure(
  params: ResolveAuthenticatedPostTurnFailureParams,
): string | null {
  if (params.openai_ok !== true) {
    const resolvedError = String(params.openai_error ?? "").trim();
    return resolvedError || "authenticatedPostTurn: upstream model failure";
  }

  const resultRecord = asRecord(params.runTurnResult ?? null);
  if (!resultRecord) {
    return "authenticatedPostTurn: runTurnResult is required";
  }

  const confirmedPayload = asRecord(resultRecord.hopy_confirmed_payload);
  if (!confirmedPayload) {
    return "authenticatedPostTurn: runTurnResult.hopy_confirmed_payload is required";
  }

  const confirmedState = asRecord(confirmedPayload.state);
  if (!confirmedState) {
    return "authenticatedPostTurn: runTurnResult.hopy_confirmed_payload.state is required";
  }

  const confirmedReply =
    typeof confirmedPayload.reply === "string"
      ? confirmedPayload.reply.trim()
      : "";
  if (!confirmedReply) {
    return "authenticatedPostTurn: runTurnResult.hopy_confirmed_payload.reply is required";
  }

  return null;
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn failure 判定責務ファイル。
openai_ok / openai_error / runTurnResult を受け取り、
postTurn 最終化を続行してよいか、または早期失敗として止めるべきかを判定する。
このファイルは hopy_confirmed_payload の存在確認だけを行い、
state_changed、state_level、current_phase、prev系、Compass、HOPY回答○を再判定しない。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から切り出すための
  postTurn failure 判定責務を新規ファイルとして作成した。
- resolveAuthenticatedPostTurnFailure(...) を定義し、
  既存の resolvePostTurnFailure(...) と同じ判定順・同じエラー文字列を維持した。
- 親ファイル接続はまだ行っていない。
- state_changed、Compass、HOPY回答○、memory、learning、thread_summary、
  audit、thread title、Future Chain、payload生成本体には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnFailure.ts
*/