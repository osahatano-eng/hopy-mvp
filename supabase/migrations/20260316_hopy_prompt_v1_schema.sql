-- /supabase/migrations/20260316_hopy_prompt_v1_schema.sql

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop table if exists public.state_transition_signals cascade;
drop table if exists public.response_generation_logs cascade;
drop table if exists public.response_expression_assets cascade;
drop table if exists public.phrase_patterns cascade;
drop table if exists public.phrase_observations cascade;

create table if not exists public.hopy_learning_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  thread_id uuid references public.conversations(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  source_assistant_message_id uuid references public.messages(id) on delete set null,
  language text not null default 'ja',
  insight_type text not null,
  body text not null,
  applicability text,
  state_scope jsonb not null default '[]'::jsonb,
  avoidance_notes text,
  evidence_count integer not null default 1,
  weight numeric(6,3) not null default 1.000,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint hopy_learning_insights_language_check
    check (language in ('ja', 'en')),
  constraint hopy_learning_insights_insight_type_check
    check (
      insight_type in (
        'expression_preference',
        'expression_avoidance',
        'state_support_style',
        'transition_support',
        'tone_preference',
        'closing_preference',
        'opener_preference',
        'rhythm_preference'
      )
    ),
  constraint hopy_learning_insights_status_check
    check (status in ('active', 'trash')),
  constraint hopy_learning_insights_evidence_count_check
    check (evidence_count >= 1),
  constraint hopy_learning_insights_weight_check
    check (weight >= 0)
);

create index if not exists hopy_learning_insights_user_status_idx
  on public.hopy_learning_insights (user_id, status, updated_at desc);

create index if not exists hopy_learning_insights_user_type_idx
  on public.hopy_learning_insights (user_id, insight_type, updated_at desc);

create index if not exists hopy_learning_insights_thread_idx
  on public.hopy_learning_insights (thread_id, updated_at desc);

create index if not exists hopy_learning_insights_source_message_idx
  on public.hopy_learning_insights (source_message_id);

create index if not exists hopy_learning_insights_source_assistant_message_idx
  on public.hopy_learning_insights (source_assistant_message_id);

create index if not exists hopy_learning_insights_weight_idx
  on public.hopy_learning_insights (user_id, weight desc, updated_at desc);

create index if not exists hopy_learning_insights_language_idx
  on public.hopy_learning_insights (language);

create index if not exists hopy_learning_insights_state_scope_gin_idx
  on public.hopy_learning_insights
  using gin (state_scope jsonb_path_ops);

create unique index if not exists hopy_learning_insights_active_dedupe_uq
  on public.hopy_learning_insights (
    user_id,
    language,
    insight_type,
    md5(body)
  )
  where status = 'active';

create table if not exists public.hopy_learning_update_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  thread_id uuid references public.conversations(id) on delete set null,
  trigger_message_id uuid references public.messages(id) on delete set null,
  assistant_message_id uuid references public.messages(id) on delete set null,
  insight_id uuid references public.hopy_learning_insights(id) on delete set null,
  action_type text not null,
  action_note text,
  delta_evidence_count integer,
  delta_weight numeric(6,3),
  created_at timestamptz not null default now(),
  constraint hopy_learning_update_logs_action_type_check
    check (
      action_type in (
        'insert',
        'merge',
        'weight_up',
        'weight_down',
        'trash',
        'restore'
      )
    )
);

create index if not exists hopy_learning_update_logs_user_created_idx
  on public.hopy_learning_update_logs (user_id, created_at desc);

create index if not exists hopy_learning_update_logs_thread_created_idx
  on public.hopy_learning_update_logs (thread_id, created_at desc);

create index if not exists hopy_learning_update_logs_trigger_message_idx
  on public.hopy_learning_update_logs (trigger_message_id);

create index if not exists hopy_learning_update_logs_assistant_message_idx
  on public.hopy_learning_update_logs (assistant_message_id);

create index if not exists hopy_learning_update_logs_insight_idx
  on public.hopy_learning_update_logs (insight_id, created_at desc);

create table if not exists public.phrase_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  thread_id uuid references public.conversations(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  language text not null default 'ja',
  original_text text not null,
  normalized_text text not null,
  phrase_type text,
  intent_label text,
  evidence_count integer not null default 1,
  weight numeric(6,3) not null default 1.000,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint phrase_observations_language_check
    check (language in ('ja', 'en')),
  constraint phrase_observations_status_check
    check (status in ('active', 'trash')),
  constraint phrase_observations_evidence_count_check
    check (evidence_count >= 1),
  constraint phrase_observations_weight_check
    check (weight >= 0)
);

create index if not exists phrase_observations_user_status_idx
  on public.phrase_observations (user_id, status, updated_at desc);

create index if not exists phrase_observations_user_language_idx
  on public.phrase_observations (user_id, language, updated_at desc);

create index if not exists phrase_observations_thread_idx
  on public.phrase_observations (thread_id, updated_at desc);

create index if not exists phrase_observations_source_message_idx
  on public.phrase_observations (source_message_id);

create index if not exists phrase_observations_normalized_idx
  on public.phrase_observations (user_id, normalized_text, updated_at desc);

create index if not exists phrase_observations_phrase_type_idx
  on public.phrase_observations (phrase_type, updated_at desc);

create index if not exists phrase_observations_metadata_gin_idx
  on public.phrase_observations
  using gin (metadata jsonb_path_ops);

create table if not exists public.phrase_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  language text not null default 'ja',
  normalized_text text not null,
  representative_text text not null,
  phrase_type text,
  intent_label text,
  evidence_count integer not null default 1,
  weight numeric(6,3) not null default 1.000,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint phrase_patterns_language_check
    check (language in ('ja', 'en')),
  constraint phrase_patterns_status_check
    check (status in ('active', 'trash')),
  constraint phrase_patterns_evidence_count_check
    check (evidence_count >= 1),
  constraint phrase_patterns_weight_check
    check (weight >= 0)
);

create index if not exists phrase_patterns_user_status_idx
  on public.phrase_patterns (user_id, status, updated_at desc);

create index if not exists phrase_patterns_user_language_idx
  on public.phrase_patterns (user_id, language, updated_at desc);

create index if not exists phrase_patterns_normalized_idx
  on public.phrase_patterns (user_id, normalized_text, updated_at desc);

create index if not exists phrase_patterns_phrase_type_idx
  on public.phrase_patterns (phrase_type, updated_at desc);

create index if not exists phrase_patterns_metadata_gin_idx
  on public.phrase_patterns
  using gin (metadata jsonb_path_ops);

create unique index if not exists phrase_patterns_active_dedupe_uq
  on public.phrase_patterns (
    user_id,
    language,
    normalized_text
  )
  where status = 'active';

drop trigger if exists set_hopy_learning_insights_updated_at
  on public.hopy_learning_insights;

create trigger set_hopy_learning_insights_updated_at
before update on public.hopy_learning_insights
for each row
execute function public.set_updated_at();

drop trigger if exists set_phrase_observations_updated_at
  on public.phrase_observations;

create trigger set_phrase_observations_updated_at
before update on public.phrase_observations
for each row
execute function public.set_updated_at();

drop trigger if exists set_phrase_patterns_updated_at
  on public.phrase_patterns;

create trigger set_phrase_patterns_updated_at
before update on public.phrase_patterns
for each row
execute function public.set_updated_at();

commit;