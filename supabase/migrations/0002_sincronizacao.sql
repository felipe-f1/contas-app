-- Banco de dados do app: contas, lançamentos e preferências de cada usuário,
-- sincronizados com o SQLite (criptografado) do celular.
--
-- Regras:
--  * Cada linha pertence a um usuário (user_id = auth.uid()) e o RLS garante
--    que ninguém lê ou altera dados de outra pessoa.
--  * atualizado_em vem do aparelho e decide conflitos: a versão mais nova vence
--    (trigger sync_lww). Exclusões são lógicas (excluido = true) para chegarem
--    aos outros aparelhos.
--  * sincronizado_em é carimbado pelo servidor e serve de cursor para o app
--    buscar só o que mudou.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.contas_fixas (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (length(id) between 1 and 100),
  tipo text not null check (tipo in ('despesa', 'receita')),
  nome text not null check (length(nome) <= 200),
  valor_centavos bigint not null check (valor_centavos >= 0),
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  categoria text not null check (length(categoria) <= 60),
  ativa boolean not null default true,
  atualizado_em timestamptz not null,
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table if not exists public.lancamentos (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (length(id) between 1 and 150),
  conta_fixa_id text,
  tipo text not null check (tipo in ('despesa', 'receita')),
  descricao text not null check (length(descricao) <= 200),
  valor_centavos bigint not null check (valor_centavos >= 0),
  categoria text not null check (length(categoria) <= 60),
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  vencimento date not null,
  pago_em date,
  parcela_grupo text,
  parcela_num smallint,
  parcela_total smallint,
  atualizado_em timestamptz not null,
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table if not exists public.meses_gerados (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null check (id ~ '^\d{4}-\d{2}$'),
  atualizado_em timestamptz not null,
  excluido boolean not null default false,
  sincronizado_em timestamptz not null default clock_timestamp(),
  primary key (user_id, id)
);

create table if not exists public.preferencias (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  dias_antes smallint not null default 3 check (dias_antes between 0 and 10),
  hora smallint not null default 9 check (hora between 0 and 23),
  email_semanal boolean not null default false,
  atualizado_em timestamptz not null,
  sincronizado_em timestamptz not null default clock_timestamp()
);

create index if not exists contas_fixas_sync_idx on public.contas_fixas (user_id, sincronizado_em);
create index if not exists lancamentos_sync_idx on public.lancamentos (user_id, sincronizado_em);
create index if not exists lancamentos_pendentes_idx on public.lancamentos (user_id, vencimento)
  where not excluido and pago_em is null and tipo = 'despesa';
create index if not exists meses_gerados_sync_idx on public.meses_gerados (user_id, sincronizado_em);

-- ---------------------------------------------------------------------------
-- "O mais recente vence" + carimbo do servidor
-- ---------------------------------------------------------------------------
create or replace function public.sync_lww()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    -- O dono nunca muda.
    new.user_id := old.user_id;
    -- Uma versão mais antiga chegando atrasada não sobrescreve a mais nova.
    if new.atualizado_em < old.atualizado_em then
      return null;
    end if;
  end if;
  new.sincronizado_em := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists sync_lww on public.contas_fixas;
create trigger sync_lww before insert or update on public.contas_fixas
  for each row execute function public.sync_lww();
drop trigger if exists sync_lww on public.lancamentos;
create trigger sync_lww before insert or update on public.lancamentos
  for each row execute function public.sync_lww();
drop trigger if exists sync_lww on public.meses_gerados;
create trigger sync_lww before insert or update on public.meses_gerados
  for each row execute function public.sync_lww();
drop trigger if exists sync_lww on public.preferencias;
create trigger sync_lww before insert or update on public.preferencias
  for each row execute function public.sync_lww();

-- ---------------------------------------------------------------------------
-- RLS: cada usuário só enxerga e altera as próprias linhas. Exclusão física
-- não é permitida pelo app (a exclusão é lógica).
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['contas_fixas', 'lancamentos', 'meses_gerados', 'preferencias'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);

    execute format('drop policy if exists "dono lê" on public.%I', t);
    execute format('create policy "dono lê" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "dono cria" on public.%I', t);
    execute format('create policy "dono cria" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);

    execute format('drop policy if exists "dono altera" on public.%I', t);
    execute format(
      'create policy "dono altera" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end;
$$;

-- A tabela de backup da versão anterior não é mais usada pelo app.
-- Depois de confirmar que tudo sincronizou, você pode apagá-la com:
--   drop table if exists public.backups;
