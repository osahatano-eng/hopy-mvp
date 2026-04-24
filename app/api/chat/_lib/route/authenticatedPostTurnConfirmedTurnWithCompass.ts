// /app/api/chat/_lib/route/authenticatedPostTurnConfirmedTurnWithCompass.ts

type HopyStateLevel = 1 | 2 | 3 | 4 | 5;

type CanonicalAssistantState = {
  current_phase: HopyStateLevel;
  state_level: HopyStateLevel;
  prev_phase: HopyStateLevel;
  prev_state_level: HopyStateLevel;
  state_changed: boolean;
};

type ConfirmedAssistantTurnForCompass = {
  assistantText: string;
  prevPhase: HopyStateLevel;
  prevStateLevel: HopyStateLevel;
  currentPhase: HopyStateLevel;
  currentStateLevel: HopyStateLevel;
  stateChanged: boolean;
  canonicalAssistantState: CanonicalAssistantState;
  compassText?: string;
  compassPrompt?: string;
  threadSummary?: string;
  thread_summary?: string;
  compass?:
    | {
        text: string;
        prompt: string | null;
      }
    | undefined;
};

export type ResolveAuthenticatedPostTurnConfirmedTurnWithCompassParams = {
  confirmedTurn: ConfirmedAssistantTurnForCompass;
  resolvedCompass: {
    compassText: string | null;
    compassPrompt: string | null;
  };
};

export type ResolveAuthenticatedPostTurnConfirmedTurnWithCompassResult = {
  confirmedTurnWithCompass: ConfirmedAssistantTurnForCompass;
  compassText: string | null;
  compassPrompt: string | null;
};

function normalizeCompassText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCompassPrompt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveAuthenticatedPostTurnConfirmedTurnWithCompass(
  params: ResolveAuthenticatedPostTurnConfirmedTurnWithCompassParams,
): ResolveAuthenticatedPostTurnConfirmedTurnWithCompassResult {
  const compassText = normalizeCompassText(params.resolvedCompass.compassText);
  const compassPrompt = normalizeCompassPrompt(
    params.resolvedCompass.compassPrompt,
  );

  return {
    confirmedTurnWithCompass: {
      ...params.confirmedTurn,
      compassText: compassText ?? undefined,
      compassPrompt: compassPrompt ?? undefined,
      compass:
        compassText !== null
          ? {
              text: compassText,
              prompt: compassPrompt,
            }
          : undefined,
      canonicalAssistantState: {
        ...params.confirmedTurn.canonicalAssistantState,
        state_changed: params.confirmedTurn.stateChanged,
      },
    },
    compassText,
    compassPrompt,
  };
}

/*
【このファイルの正式役割】
authenticated 経路の postTurn Compass付き confirmedTurn 整形責務ファイル。
同期済み confirmedTurn と resolvedCompass を受け取り、
Compass表示・保存に使う confirmedTurnWithCompass と
正規化済み compassText / compassPrompt を返す。
このファイルは Compass を生成せず、
state_changed、state_level、current_phase、prev系、HOPY回答○を再判定しない。
受け取った confirmedTurn.stateChanged と resolvedCompass をそのまま整形するだけを担当する。

【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/authenticatedPostTurn.ts から切り出すための
  Compass付き confirmedTurn 整形責務を新規ファイルとして作成した。
- normalizeCompassText(...)、
  normalizeCompassPrompt(...)、
  resolveAuthenticatedPostTurnConfirmedTurnWithCompass(...) を定義した。
- 既存の confirmedTurnWithCompass 作成と同じ整形内容を維持した。
- 親ファイル接続はまだ行っていない。
- state_changed、state_level、current_phase、prev系、Compass生成、HOPY回答○、
  memory、learning、thread_summary、audit、thread title、Future Chain、
  payload生成本体には触れていない。

/app/api/chat/_lib/route/authenticatedPostTurnConfirmedTurnWithCompass.ts
*/