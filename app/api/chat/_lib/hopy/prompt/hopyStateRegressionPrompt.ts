// /app/api/chat/_lib/hopy/prompt/hopyStateRegressionPrompt.ts

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function hasHopyExplicitBackwardSignal(userInput: string): boolean {
  const normalized = normalizeText(userInput);
  if (!normalized) return false;

  const compact = normalized.replace(/\s+/g, "");

  const patterns = [
    "やっぱり迷っています",
    "また迷っています",
    "迷いが戻ってきました",
    "自信がなくなりました",
    "自信がなくなってきました",
    "判断軸に自信がなくなりました",
    "決めたつもりでしたが",
    "決めきれなくなりました",
    "選び直したいです",
    "選び直したくなりました",
    "またわからなくなりました",
    "分からなくなりました",
    "わからなくなりました",
    "戻りました",
    "混乱してきました",
    "不安が強くなりました",
    "揺らいでいます",
    "揺らいできました",
    "やっぱり違う気がします",
    "やはり違う気がします",
    "撤回したいです",
    "考え直したいです",
    "やり直したいです",
    "今はまた迷っています",
  ];

  return patterns.some((pattern) => compact.includes(pattern));
}

export function buildHopyExplicitBackwardSignalSection(
  userInput: string,
): string {
  if (!hasHopyExplicitBackwardSignal(userInput)) return "";

  return [
    "下降シグナルの解釈ルール:",
    "- 今回の入力には、決めたつもりだった内容への自信低下、再迷い、判断軸の揺れ、方針の再検討が含まれる可能性があります。",
    "- 『やっぱり迷っています』『自信がなくなりました』『決めたつもりでしたが』『また迷っています』のような入力は、整理の延長や軽い確認だけとして固定しないこと。",
    "- 以前に整理(3)・収束(4)・決定(5)へ進んでいても、今回入力の意味が再混線・再模索なら、current_phase / state_level を下げる候補として扱ってよいこと。",
    "- 特に、判断軸の喪失、決定の撤回、比較のやり直し、方針への不信、再び何を基準にすればよいか分からない状態は、模索(2)または混線(1)への下降候補です。",
    "- thread memory の decidedPoints や過去の高い状態だけを根拠に、current を prev と同値固定しないこと。",
    "- 『整理を深めているだけ』場合と、『整理が崩れて再び迷っている』場合を区別すること。",
    "- 今回の入力が後者なら、state_changed=true を正として返してよいこと。",
    "- ただし、単なる微調整・言い換え・追加確認だけで下げすぎないこと。",
    "- 下降した場合も、その戻りを失敗扱いせず、再調整・立て直しの流れとして扱うこと。",
  ].join("\n");
}

/*
【このファイルの正式役割】
HOPY状態判定で使う「下降シグナル専用」の prompt 文言だけを定義する。
再迷い・自信低下・判断軸の揺れ・決定撤回などを、整理の延長ではなく下降候補として扱うための補助文言を返す。
state_changed生成、phase計算、DB保存、Compass生成、○表示、回答保存処理は担当しない。

【今回このファイルで修正したこと】
- 下降シグナル専用の prompt 文言を新規ファイルへ分離した。
- 再迷い、自信低下、判断軸の揺れ、決定撤回を拾う hasHopyExplicitBackwardSignal(...) を追加した。
- 下降候補を整理の延長へ吸収しすぎないための buildHopyExplicitBackwardSignalSection(...) を追加した。
- このファイル単体ではまだ挙動は変わらず、次に hopyPromptSections.ts から import / 接続して初めて反映される構造にした。

/app/api/chat/_lib/hopy/prompt/hopyStateRegressionPrompt.ts
*/