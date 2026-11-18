-- Contas fixas com prazo: último mês em que a conta vale (null = sem fim).
alter table public.contas_fixas
  add column if not exists termina_em text check (termina_em ~ '^\d{4}-\d{2}$');

-- Faz a API (PostgREST) enxergar a coluna nova imediatamente.
notify pgrst, 'reload schema';
