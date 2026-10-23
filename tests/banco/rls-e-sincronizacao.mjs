import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Roda as migrações do Supabase num Postgres embutido (PGlite) e verifica RLS e conflitos.
const raiz = new URL('../..', import.meta.url).pathname;
const db = new PGlite();
// --- Simulação mínima do Supabase ---
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  insert into auth.users values ('00000000-0000-0000-0000-00000000000a','a@x.com'), ('00000000-0000-0000-0000-00000000000b','b@x.com');
`);
for (const f of ['0001_backups.sql', '0002_sincronizacao.sql', '0003_excluir_conta.sql']) await db.exec(readFileSync(`${raiz}/supabase/migrations/${f}`, 'utf8'));
// rodar de novo: migração precisa ser idempotente
await db.exec(readFileSync(`${raiz}/supabase/migrations/0002_sincronizacao.sql`, 'utf8'));
console.log('✓ migrações executadas (e reexecutadas sem erro)');

const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
async function como(uid, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const upsert = `insert into public.lancamentos (id, tipo, descricao, valor_centavos, categoria, mes, vencimento, atualizado_em, excluido)
  values ($1, 'despesa', $2, 100, 'Outros', '2026-10', '2026-10-10', $3, false)
  on conflict (user_id, id) do update set descricao = excluded.descricao, atualizado_em = excluded.atualizado_em
  returning descricao, sincronizado_em`;

// 1. upsert sem user_id (default auth.uid())
const r1 = await como(A, upsert, ['l1', 'Luz v1', '2026-10-23T12:00:00Z']);
assert.equal(r1.rows[0].descricao, 'Luz v1');
const dono = await db.query(`select user_id from public.lancamentos where id = 'l1'`);
assert.equal(dono.rows[0].user_id, A);
console.log('✓ insert grava o dono pela sessão (auth.uid)');

// 2. isolamento entre usuários
assert.equal((await como(B, `select * from public.lancamentos`)).rows.length, 0);
assert.equal((await como(B, `update public.lancamentos set descricao = 'hack'`)).affectedRows, 0);
await assert.rejects(como(B, `insert into public.lancamentos (user_id, id, tipo, descricao, valor_centavos, categoria, mes, vencimento, atualizado_em)
  values ('${A}', 'x', 'despesa', 'hack', 1, 'Outros', '2026-10', '2026-10-10', now())`), /row-level security/);
await assert.rejects(como(B, `delete from public.lancamentos`), /permission denied/);
await assert.rejects(como(null, `select * from public.lancamentos`), /permission denied/);
// Mesmo id para outro usuário não colide (PK inclui user_id)
await como(B, upsert, ['l1', 'Da B', '2026-10-23T12:00:00Z']);
assert.equal((await como(A, `select descricao from public.lancamentos where id = 'l1'`)).rows[0].descricao, 'Luz v1');
console.log('✓ RLS: B não lê, não altera, não cria em nome de A, não apaga; anon sem acesso; ids não colidem');

// 3. "o mais recente vence"
const antes = (await db.query(`select sincronizado_em from public.lancamentos where id='l1' and user_id='${A}'`)).rows[0].sincronizado_em;
await como(A, upsert, ['l1', 'Luz VELHA', '2026-10-23T11:00:00Z']);
assert.equal((await como(A, `select descricao from public.lancamentos where id='l1'`)).rows[0].descricao, 'Luz v1');
await como(A, upsert, ['l1', 'Luz v2', '2026-10-23T13:00:00Z']);
const depois = (await como(A, `select descricao, sincronizado_em from public.lancamentos where id='l1'`)).rows[0];
assert.equal(depois.descricao, 'Luz v2');
assert.ok(depois.sincronizado_em > antes);
console.log('✓ LWW: versão antiga ignorada, versão nova aplicada e carimbada');

// 4. dono não pode ser trocado
await como(A, `update public.lancamentos set user_id = '${B}' where id = 'l1'`).catch(() => {});
assert.equal((await db.query(`select count(*)::int n from public.lancamentos where user_id='${A}' and id='l1'`)).rows[0].n, 1);
console.log('✓ user_id imutável');

// 5. preferências: upsert por user_id
const pref = `insert into public.preferencias (dias_antes, hora, email_semanal, atualizado_em) values ($1, 9, true, $2)
  on conflict (user_id) do update set dias_antes = excluded.dias_antes, atualizado_em = excluded.atualizado_em`;
await como(A, pref, [3, '2026-10-23T12:00:00Z']);
await como(A, pref, [5, '2026-10-23T13:00:00Z']);
assert.equal((await como(A, `select dias_antes from public.preferencias`)).rows[0].dias_antes, 5);
assert.equal((await como(B, `select * from public.preferencias`)).rows.length, 0);
console.log('✓ preferências por usuário');

// 6. validações
await assert.rejects(como(A, upsert.replace("'2026-10'", "'outubro'"), ['l9', 'x', '2026-10-23T12:00:00Z']), /check constraint/);
console.log('✓ constraints rejeitam dados inválidos');
// 7. exclusão de conta: só a própria, com todos os dados em cascata
await assert.rejects(como(null, `select public.excluir_minha_conta()`), /permission denied/);
const contar = async (uid) => (await db.query(`select
  (select count(*)::int from public.lancamentos where user_id = '${uid}') +
  (select count(*)::int from public.preferencias where user_id = '${uid}') +
  (select count(*)::int from auth.users where id = '${uid}') as n`)).rows[0].n;
assert.ok((await contar(A)) > 0 && (await contar(B)) > 0);
await como(A, `select public.excluir_minha_conta()`);
assert.equal(await contar(A), 0);
assert.ok((await contar(B)) > 0, 'dados de B não podem ser afetados');
console.log('✓ excluir conta: apaga só o próprio usuário e todos os seus dados; anon não executa');
console.log('TODOS OS TESTES DO BANCO PASSARAM');
