// /app/api/chat/_lib/hopy/openai/hopyOpenAIRetry.ts

export function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  if (!(ms > 0)) return p;

  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);

    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableOpenAIError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("openai_timeout")) return true;
  if (lowerMessage.includes("timeout")) return true;
  if (lowerMessage.includes("rate limit")) return true;
  if (lowerMessage.includes("temporarily")) return true;
  if (lowerMessage.includes("temporarily unavailable")) return true;
  if (lowerMessage.includes("overloaded")) return true;
  if (lowerMessage.includes("connection")) return true;
  if (lowerMessage.includes("network")) return true;
  if (lowerMessage.includes("fetch failed")) return true;
  if (lowerMessage.includes("econnreset")) return true;
  if (lowerMessage.includes("socket hang up")) return true;
  if (lowerMessage.includes("empty_json_content")) return true;
  if (lowerMessage.includes("invalid_json_object_content")) return true;
  if (lowerMessage.includes("invalid_hopy_json_contract")) return true;

  const status = Number((error as { status?: unknown } | null)?.status);
  if (status === 408 || status === 409 || status === 429) return true;
  if (status >= 500 && status < 600) return true;

  const code = String(
    (error as { code?: unknown } | null)?.code ?? "",
  ).toLowerCase();
  if (code === "etimedout") return true;
  if (code === "econnreset") return true;
  if (code === "und_err_connect_timeout") return true;

  const name = String(
    (error as { name?: unknown } | null)?.name ?? "",
  ).toLowerCase();
  if (name.includes("timeout")) return true;
  if (name.includes("connection")) return true;
  if (name.includes("rate")) return true;

  return false;
}

export async function withSingleRetry<T>(args: {
  run: () => Promise<T>;
  retryDelayMs: number;
}): Promise<T> {
  try {
    return await args.run();
  } catch (error) {
    if (!isRetryableOpenAIError(error)) {
      throw error;
    }

    if (args.retryDelayMs > 0) {
      await sleep(args.retryDelayMs);
    }

    return args.run();
  }
}

/*
このファイルの正式役割:
OpenAI completion 実行時の timeout と一時失敗時の single retry を担当するファイル。
timeout 付き Promise 実行、retry 対象エラー判定、retry 前の短い待機、1回だけの再実行を担う。
OpenAI messages 組み立て、completion 実行本体、JSON契約検証、プロンプト文言生成、DB保存復元、HOPY唯一の正の再判定は担当しない。
*/

/*
【今回このファイルで修正したこと】
- /app/api/chat/_lib/route/openaiExecution.ts に残っている timeout / retry 責務を受け取る新規ファイルとして作成しました。
- withTimeout(...) と withSingleRetry(...) を export しました。
- retry 対象エラー判定と sleep は、このファイル内だけの内部処理として残しました。
- HOPY唯一の正、state値 1..5、Compass契約条件、JSON契約検証、OpenAI messages 組み立て、completion 実行本体はこのファイルでは再判定・再生成していません。
*/

/* /app/api/chat/_lib/hopy/openai/hopyOpenAIRetry.ts */