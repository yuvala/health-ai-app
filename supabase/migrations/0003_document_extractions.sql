create table if not exists public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('queued', 'extracting', 'parsing', 'review_needed', 'completed', 'failed')),
  document_date date,
  date_confidence numeric,
  extracted_text text,
  parsed_results jsonb,
  parser_version text not null default 'regex-v1',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_document_extractions_user_id on public.document_extractions(user_id);
create index if not exists idx_document_extractions_status on public.document_extractions(status);

alter table public.document_extractions enable row level security;

drop policy if exists "document_extractions_owner_all" on public.document_extractions;
create policy "document_extractions_owner_all" on public.document_extractions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.lab_results
  add column if not exists test_code text,
  add column if not exists source_document_id uuid references public.documents(id) on delete set null,
  add column if not exists confidence numeric,
  add column if not exists is_verified boolean not null default false;

create index if not exists idx_lab_results_test_code_measured_at
  on public.lab_results(test_code, measured_at desc);
