-- Enable UUID generation.
create extension if not exists "pgcrypto";

-- Profiles table: one row per auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  test_name text not null,
  value numeric not null,
  unit text not null,
  reference_range text,
  measured_at timestamptz not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text,
  frequency text,
  notes text,
  created_at timestamptz not null default now()
);

-- Metadata only; files are kept in Supabase Storage.
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_type text not null,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  insight_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_lab_results_user_id on public.lab_results(user_id);
create index if not exists idx_medications_user_id on public.medications(user_id);
create index if not exists idx_documents_user_id on public.documents(user_id);
create index if not exists idx_ai_insights_user_id on public.ai_insights(user_id);

alter table public.profiles enable row level security;
alter table public.lab_results enable row level security;
alter table public.medications enable row level security;
alter table public.documents enable row level security;
alter table public.ai_insights enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "lab_results_owner_all" on public.lab_results;
create policy "lab_results_owner_all" on public.lab_results
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "medications_owner_all" on public.medications;
create policy "medications_owner_all" on public.medications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "documents_owner_all" on public.documents;
create policy "documents_owner_all" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_insights_owner_all" on public.ai_insights;
create policy "ai_insights_owner_all" on public.ai_insights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Keep profiles synchronized with auth.users on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();