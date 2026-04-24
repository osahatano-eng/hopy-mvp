// /app/api/chat/_lib/route/authenticatedPostTurnStateCompassInvariant.ts

type ResolvedPlan = "free" | "plus" | "pro";

type ConfirmedAssistantTurnForStateCompassInvariant = {
  stateChanged: boolean;
};

export type ResolveAuthenticatedPostTurnStateCompassInvariantParams = {
  resolvedPlan: ResolvedPlan;
  confirmedTurn: ConfirmedAssistantTurnForStateCompassInvariant;
  resolvedCompass: {
    compassText: string | null;
    compassPrompt: string | null;
  };
};

function normalizeCompassText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveAuthenticatedPostTurnStateCompassInvariant(
  params: ResolveAuthenticatedPostTurnStateCompassInvariantParams,
): string | null {
  const stateChanged = params.confirmedTurn.stateChanged === true;
  const compassText = normalizeCompassText(params.resolvedCompass.compassText);
  const isPaidPlan =
    params.resolvedPlan === "plus" || params.resolvedPlan === "pro";

  if (!stateChanged && compassText !== null) {
    return "authenticatedPostTurn: compass_present_while_state_changed_false";
  }

  if (stateChanged && isPaidPlan && compassText === null) {
    return "authenticatedPostTurn: plus_pro_requires_compass_when_state_changed_true";
  }

  return null;
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn state_changed / Compass 整合検証責務ファイル。
resolvedPlan、confirmedTurn.stateChanged、resolvedCompass を受け取り、
state_changed と Compass の組み合わせが HOPY の唯一の正に反していないかだけを検証する。
このファイルは state_changed、state_level、current_phase、prev系、Compass を生成・再判定せず、
受け取った確定値の整合確認だけを担当する。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から切り出すための
  state_changed と Compass の整合検証責務を新規ファイルとして作成した。
- resolveAuthenticatedPostTurnStateCompassInvariant(...) を定義した。
- 既存の resolvePostTurnStateCompassInvariant(...) と同じ判定条件・同じエラー文字列を維持した。
- 親ファイル接続はまだ行っていない。
- state_changed、state_level、current_phase、prev系、Compass、HOPY回答○、memory、
  learning、thread_summary、audit、thread title、Future Chain、payload生成本体には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnStateCompassInvariant.ts
*/