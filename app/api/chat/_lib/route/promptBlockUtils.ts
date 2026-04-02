// /app/api/chat/_lib/route/promptBlockUtils.ts

export function normalizePromptBlock(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

export function splitPromptLines(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function stripPromptBullet(line: string): string {
  return line.replace(/^[-・]\s*/, "").trim();
}

export function uniquePromptLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const normalized = stripPromptBullet(line);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(line);
  }

  return result;
}

export function compactPromptBlock(args: {
  block: string;
  maxLines: number;
  maxChars: number;
  keepFirstLineAsHeader?: boolean;
}): string {
  const normalizedBlock = normalizePromptBlock(args.block);
  if (!normalizedBlock) return "";

  const lines = uniquePromptLines(splitPromptLines(normalizedBlock));
  if (lines.length <= 0) return "";

  const keepHeader =
    args.keepFirstLineAsHeader === true && lines.length > 0 ? lines[0] : null;

  const bodyLines = keepHeader ? lines.slice(1) : lines;

  const limitedLines = bodyLines.slice(
    0,
    Math.max(0, args.maxLines - (keepHeader ? 1 : 0)),
  );

  const mergedLines = keepHeader ? [keepHeader, ...limitedLines] : limitedLines;

  if (mergedLines.length <= 0) return "";

  const compacted = mergedLines.join("\n").trim();
  if (compacted.length <= args.maxChars) {
    return compacted;
  }

  const result: string[] = [];
  let currentLength = 0;

  for (const line of mergedLines) {
    const additional = result.length === 0 ? line.length : line.length + 1;
    if (currentLength + additional > args.maxChars) {
      break;
    }
    result.push(line);
    currentLength += additional;
  }

  return result.join("\n").trim();
}