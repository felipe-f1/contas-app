-- Backup dos dados do app: uma linha por usuário com a "foto" completa em JSON.
create table if not exists public.backups (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  dados jsonb not null,
  email_semanal boolean not null default false,
  atualizado_em timestamptz not null default now()
);

-- Cada usuário só enxerga e altera o próprio backup.
alter table public.backups enable row level security;

create policy "backup: dono lê" on public.backups
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "backup: dono cria" on public.backups
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "backup: dono atualiza" on public.backups
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "backup: dono apaga" on public.backups
  for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists backups_email_semanal_idx on public.backups (email_semanal) where email_semanal;
