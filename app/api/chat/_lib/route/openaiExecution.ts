// /app/api/chat/_lib/route/openaiExecution.ts

export { buildOpenAIMessages } from "../hopy/openai/hopyOpenAIMessages";
export { createJsonForcedCompletion } from "../hopy/openai/hopyJsonForcedCompletion";
export { createPlainCompletion } from "../hopy/openai/hopyPlainCompletion";
export type {
  HistoryItem,
  OpenAIChatMessage,
} from "../hopy/openai/hopyOpenAIMessages";
export { withTimeout } from "../hopy/openai/hopyOpenAIRetry";

/*
このファイルの正式役割:
OpenAI 実行系の入口として、分離済み責務を re-export するファイル。
OpenAI へ渡す messages の組み立ては、
/app/api/chat/_lib/hopy/openai/hopyOpenAIMessages.ts から読み込む。
JSON forced completion 実行は、
/app/api/chat/_lib/hopy/openai/hopyJsonForcedCompletion.ts から読み込む。
plain completion 実行は、
/app/api/chat/_lib/hopy/openai/hopyPlainCompletion.ts から読み込む。
OpenAI completion 実行時の timeout は、
/app/api/chat/_lib/hopy/openai/hopyOpenAIRetry.ts から読み込む。
このファイルは既存 import 互換を保ちながら、
OpenAI 実行系の入口として必要な export だけを担う。
*/

/*
【今回このファイルで修正したこと】
- plain completion 実行責務を /app/api/chat/_lib/hopy/openai/hopyPlainCompletion.ts へ移し、このファイルでは createPlainCompletion(...) を re-export するだけにしました。
- OpenAI、OpenAIChatMessage、withSingleRetry、withTimeout、phaseParams の import と createPlainCompletion(...) 本体をこのファイルから削除しました。
- 既存互換のため buildOpenAIMessages / createJsonForcedCompletion / createPlainCompletion / HistoryItem / OpenAIChatMessage / withTimeout はこのファイルから引き続き export します。
- state値 1..5、HOPY唯一の正、Compass契約条件、JSON契約検証、messages 組み立て、DB保存復元は変更していません。
*/

/* /app/api/chat/_lib/route/openaiExecution.ts */