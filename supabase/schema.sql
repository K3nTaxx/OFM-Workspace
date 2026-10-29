-- Workspace OFM — schéma de la base Supabase
-- À coller une seule fois dans Supabase : SQL Editor → New query → Run.

create extension if not exists pgcrypto;

-- ---------- Tables ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'gray',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  number int not null,
  title text not null default '',
  date date not null default current_date,
  time text,
  duration_min int,
  type text not null default 'mentorat' check (type in ('mentorat', 'decouverte', 'questions', 'interne')),
  participants text[] not null default '{}',
  themes text[] not null default '{}',
  video_url text,
  summary jsonb,
  actions jsonb not null default '[]',
  transcript jsonb,
  status text not null default 'ready' check (status in ('ready', 'planned')),
  hue int not null default 222,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category_id uuid references public.categories (id) on delete set null,
  kind text not null default 'other',
  file_name text,
  size bigint,
  path text,
  url text,
  source text,
  call_id uuid references public.calls (id) on delete set null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists calls_date_idx on public.calls (date desc);
create index if not exists documents_category_idx on public.documents (category_id);

-- Mise à jour automatique de updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists calls_touch on public.calls;
create trigger calls_touch before update on public.calls
  for each row execute function public.touch_updated_at();

-- ---------- Sécurité : seuls les comptes connectés (Quentin et Logan) accèdent aux données ----------
alter table public.categories enable row level security;
alter table public.calls enable row level security;
alter table public.documents enable row level security;

drop policy if exists "equipe" on public.categories;
create policy "equipe" on public.categories for all to authenticated using (true) with check (true);
drop policy if exists "equipe" on public.calls;
create policy "equipe" on public.calls for all to authenticated using (true) with check (true);
drop policy if exists "equipe" on public.documents;
create policy "equipe" on public.documents for all to authenticated using (true) with check (true);

-- ---------- Temps réel : ce que l'un modifie apparaît chez l'autre ----------
do $$
begin
  begin alter publication supabase_realtime add table public.calls; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.documents; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.categories; exception when duplicate_object then null; end;
end $$;

-- ---------- Fichiers (PDF, transcriptions) : espace privé ----------
insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

drop policy if exists "equipe lit" on storage.objects;
create policy "equipe lit" on storage.objects for select to authenticated using (bucket_id = 'files');
drop policy if exists "equipe ajoute" on storage.objects;
create policy "equipe ajoute" on storage.objects for insert to authenticated with check (bucket_id = 'files');
drop policy if exists "equipe modifie" on storage.objects;
create policy "equipe modifie" on storage.objects for update to authenticated using (bucket_id = 'files');
drop policy if exists "equipe supprime" on storage.objects;
create policy "equipe supprime" on storage.objects for delete to authenticated using (bucket_id = 'files');

-- ---------- Catégories de départ ----------
insert into public.categories (name, color, position)
select * from (values
  ('Chatting', 'pink', 0),
  ('Marketing & Trafic', 'blue', 1),
  ('Recrutement', 'green', 2),
  ('Onboarding', 'purple', 3),
  ('Juridique & Contrats', 'red', 4),
  ('Outils & Process', 'gray', 5),
  ('Finance', 'yellow', 6)
) as v(name, color, position)
where not exists (select 1 from public.categories);

-- ---------- Notes personnelles : chacun ne voit, ne modifie et ne supprime que les siennes ----------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  blocks jsonb not null default '[]',
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id, updated_at desc);

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch before update on public.notes
  for each row execute function public.touch_updated_at();

alter table public.notes enable row level security;
drop policy if exists "mes notes" on public.notes;
create policy "mes notes" on public.notes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
begin
  begin alter publication supabase_realtime add table public.notes; exception when duplicate_object then null; end;
end $$;

-- ---------- Outil de maintenance : exécuter du SQL avec la clé secrète (scripts/sql.mjs) ----------
-- Permet de faire évoluer la base (nouvelle table, nouvelle colonne…) depuis l'ordinateur de Quentin, sans ouvrir le
-- tableau de bord Supabase. Réservé à la clé secrète (rôle service_role) : ni les visiteurs ni les comptes connectés
-- du site ne peuvent l'appeler.
create or replace function public.exec_sql(sql text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  execute sql;
end $$;

revoke all on function public.exec_sql(text) from public, anon, authenticated;
grant execute on function public.exec_sql(text) to service_role;
