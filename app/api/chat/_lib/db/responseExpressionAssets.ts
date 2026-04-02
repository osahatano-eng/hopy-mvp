// /app/api/chat/_lib/db/responseExpressionAssets.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export type ResponseExpressionAssetRecord = {
  id: string;
  language: "ja" | "en";
  expression_text: string;
  semantic_label: string | null;
  tone_label: string | null;
  for_state_level: number | null;
  transition_target_level: number | null;
  style_group: string | null;
  safety_status: "pending" | "approved" | "blocked";
  source_pattern_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertResponseExpressionAssetInput = {
  language?: unknown;
  expressionText: unknown;
  semanticLabel?: unknown;
  toneLabel?: unknown;
  forStateLevel?: unknown;
  transitionTargetLevel?: unknown;
  styleGroup?: unknown;
  safetyStatus?: unknown;
  sourcePatternId?: unknown;
};

type InsertResponseExpressionAssetParams = {
  supabase: SupabaseClient;
  input: InsertResponseExpressionAssetInput;
};

type ListResponseExpressionAssetsParams = {
  supabase: SupabaseClient;
  language?: unknown;
  forStateLevel?: unknown;
  transitionTargetLevel?: unknown;
  semanticLabel?: unknown;
  toneLabel?: unknown;
  styleGroup?: unknown;
  onlyApproved?: boolean;
  limit?: number;
};

type GetResponseExpressionAssetByIdParams = {
  supabase: SupabaseClient;
  id: unknown;
};

type InsertResponseExpressionAssetResult =
  | { ok: true; asset: ResponseExpressionAssetRecord }
  | { ok: false; error: unknown };

type ListResponseExpressionAssetsResult =
  | { ok: true; assets: ResponseExpressionAssetRecord[] }
  | { ok: false; error: unknown; assets: ResponseExpressionAssetRecord[] };

type GetResponseExpressionAssetByIdResult =
  | { ok: true; asset: ResponseExpressionAssetRecord | null }
  | { ok: false; error: unknown; asset: null };

function normalizeRequired(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeOptional(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

function normalizeLanguage(value: unknown): "ja" | "en" {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "en" ? "en" : "ja";
}

function normalizeLevel(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  if (n < 1 || n > 5) return null;
  return n;
}

function normalizeSafetyStatus(
  value: unknown,
): "pending" | "approved" | "blocked" {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "approved") return "approved";
  if (s === "blocked") return "blocked";
  return "pending";
}

function normalizeLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n)) return 20;
  if (n < 1) return 1;
  if (n > 100) return 100;
  return n;
}

export async function insertResponseExpressionAsset(
  params: InsertResponseExpressionAssetParams,
): Promise<InsertResponseExpressionAssetResult> {
  const { supabase, input } = params;

  const expression_text = normalizeRequired(input.expressionText);
  if (!expression_text) {
    return {
      ok: false,
      error: new Error("expressionText is required."),
    };
  }

  const payload = {
    language: normalizeLanguage(input.language),
    expression_text,
    semantic_label: normalizeOptional(input.semanticLabel),
    tone_label: normalizeOptional(input.toneLabel),
    for_state_level: normalizeLevel(input.forStateLevel),
    transition_target_level: normalizeLevel(input.transitionTargetLevel),
    style_group: normalizeOptional(input.styleGroup),
    safety_status: normalizeSafetyStatus(input.safetyStatus),
    source_pattern_id: normalizeOptional(input.sourcePatternId),
  };

  const { data, error } = await supabase
    .from("response_expression_assets")
    .insert(payload)
    .select("*")
    .single<ResponseExpressionAssetRecord>();

  if (error || !data) {
    return {
      ok: false,
      error: error ?? new Error("Failed to insert response expression asset."),
    };
  }

  return {
    ok: true,
    asset: data,
  };
}

export async function listResponseExpressionAssets(
  params: ListResponseExpressionAssetsParams,
): Promise<ListResponseExpressionAssetsResult> {
  const {
    supabase,
    language,
    forStateLevel,
    transitionTargetLevel,
    semanticLabel,
    toneLabel,
    styleGroup,
    onlyApproved = true,
    limit,
  } = params;

  let query = supabase
    .from("response_expression_assets")
    .select("*")
    .eq("language", normalizeLanguage(language))
    .limit(normalizeLimit(limit));

  const normalizedForStateLevel = normalizeLevel(forStateLevel);
  const normalizedTransitionTargetLevel = normalizeLevel(transitionTargetLevel);
  const normalizedSemanticLabel = normalizeOptional(semanticLabel);
  const normalizedToneLabel = normalizeOptional(toneLabel);
  const normalizedStyleGroup = normalizeOptional(styleGroup);

  if (normalizedForStateLevel !== null) {
    query = query.eq("for_state_level", normalizedForStateLevel);
  }

  if (normalizedTransitionTargetLevel !== null) {
    query = query.eq(
      "transition_target_level",
      normalizedTransitionTargetLevel,
    );
  }

  if (normalizedSemanticLabel) {
    query = query.eq("semantic_label", normalizedSemanticLabel);
  }

  if (normalizedToneLabel) {
    query = query.eq("tone_label", normalizedToneLabel);
  }

  if (normalizedStyleGroup) {
    query = query.eq("style_group", normalizedStyleGroup);
  }

  if (onlyApproved) {
    query = query.eq("safety_status", "approved");
  }

  const { data, error } = await query
    .order("for_state_level", { ascending: true, nullsFirst: false })
    .order("transition_target_level", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      ok: false,
      error,
      assets: [],
    };
  }

  return {
    ok: true,
    assets: (data ?? []) as ResponseExpressionAssetRecord[],
  };
}

export async function getResponseExpressionAssetById(
  params: GetResponseExpressionAssetByIdParams,
): Promise<GetResponseExpressionAssetByIdResult> {
  const { supabase, id } = params;

  const normalizedId = normalizeRequired(id);
  if (!normalizedId) {
    return {
      ok: false,
      error: new Error("id is required."),
      asset: null,
    };
  }

  const { data, error } = await supabase
    .from("response_expression_assets")
    .select("*")
    .eq("id", normalizedId)
    .maybeSingle<ResponseExpressionAssetRecord>();

  if (error) {
    return {
      ok: false,
      error,
      asset: null,
    };
  }

  return {
    ok: true,
    asset: data ?? null,
  };
}