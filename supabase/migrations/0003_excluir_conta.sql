-- Exclusão de conta pelo próprio usuário (exigência da Google Play e da App Store).
--
-- Apaga o usuário em auth.users; as tabelas do app têm "on delete cascade",
-- então todos os dados dele somem junto. A função roda com os privilégios do
-- dono (security definer), mas só consegue apagar quem está chamando:
-- auth.uid() vem do token da sessão e não pode ser escolhido pelo app.
create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := auth.uid();
begin
  if eu is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  delete from auth.users where id = eu;
end;
$$;

revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;
