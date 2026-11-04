-- Ping diário para o projeto não ser pausado por inatividade (plano gratuito
-- do Supabase pausa após 7 dias sem uso). Chamado pelo workflow
-- .github/workflows/manter-supabase-ativo.yml.
--
-- Não lê nenhuma tabela nem dado de usuário: só faz uma consulta real no
-- Postgres e devolve a hora do servidor.
create or replace function public.manter_ativo()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.manter_ativo() from public;
grant execute on function public.manter_ativo() to anon, authenticated;
