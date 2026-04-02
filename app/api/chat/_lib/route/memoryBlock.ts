// /app/api/chat/_lib/route/memoryBlock.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadMemoriesForPrompt } from "../db/memories";
import { envInt } from "../infra/env";
import type { Lang } from "../router/simpleRouter";

export type MemoryBlockResult = {
  memoryBlock: string;
  memoryInjected: boolean;
};

const MEMORY_BLOCK_MAX_LINES = 8;

function trimText(value: unknown): string {
  return String(value ?? "").trim();
}

function clampMemoryText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd() + "\n…(truncated)";
}

function splitMemoryLines(block: string): string[] {
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function stripMemoryBullet(line: string): string {
  return line.replace(/^[-・]\s*/, "").trim();
}

function uniqueMemoryLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const normalized = stripMemoryBullet(line);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(line);
  }

  return result;
}

function compactMemoryBlockText(args: {
  dbText: string;
  clientBlock: string;
  uiLang: Lang;
  maxChars: number;
  maxLines: number;
}): string {
  const header =
    args.uiLang === "en" ? "MEMORIES (high-signal):" : "記憶（重要）:";

  const mergedLines = uniqueMemoryLines([
    ...splitMemoryLines(args.dbText),
    ...splitMemoryLines(args.clientBlock),
  ]).slice(0, args.maxLines);

  if (mergedLines.length <= 0) {
    return "";
  }

  const mergedBody = mergedLines.join("\n");
  const body = clampMemoryText(mergedBody, args.maxChars);

  return [header, body].join("\n");
}

export async function buildMemoryBlock(args: {
  supabase: SupabaseClient;
  userId: string;
  uiLang: Lang;
  clientMemoryBlock: string;
}): Promise<MemoryBlockResult> {
  const clientBlock = trimText(args.clientMemoryBlock);
  const limit = envInt("HOPY_MEMORY_LIMIT", 12);
  const maxChars = envInt("HOPY_MEMORYBLOCK_MAX_CHARS", 4200);

  try {
    const memRes = await loadMemoriesForPrompt({
      supabase: args.supabase,
      userId: args.userId,
      limit,
      uiLang: args.uiLang,
    });

    const dbTextRaw = memRes.ok ? trimText(memRes.text) : "";
    const finalMemoryBlock = compactMemoryBlockText({
      dbText: dbTextRaw,
      clientBlock,
      uiLang: args.uiLang,
      maxChars,
      maxLines: MEMORY_BLOCK_MAX_LINES,
    });

    return {
      memoryBlock: finalMemoryBlock,
      memoryInjected: Boolean(finalMemoryBlock),
    };
  } catch {
    const fallbackBlock = compactMemoryBlockText({
      dbText: "",
      clientBlock,
      uiLang: args.uiLang,
      maxChars,
      maxLines: MEMORY_BLOCK_MAX_LINES,
    });

    return {
      memoryBlock: fallbackBlock,
      memoryInjected: Boolean(fallbackBlock),
    };
  }
}