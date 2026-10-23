/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deveBloquear,
  doServidor,
  inicioDaBusca,
  paraServidor,
  pinValido,
  problemaNaSenha,
  remotoVence,
} from '../src/lib/regrasSync.ts';

test('conflito: sem alteração local, o servidor sempre vence', () => {
  assert.equal(remotoVence(null, { atualizado_em: '2026-01-01T00:00:00Z' }), true);
  assert.equal(remotoVence({ atualizado_em: '2026-10-23T12:00:00.000Z', sujo: 0 }, { atualizado_em: '2026-10-01T00:00:00Z' }), true);
});

test('conflito: com alteração local pendente, vence a mais recente', () => {
  const local = { atualizado_em: '2026-10-23T12:00:00.000Z', sujo: 1 };
  assert.equal(remotoVence(local, { atualizado_em: '2026-10-23T11:59:59+00:00' }), false);
  assert.equal(remotoVence(local, { atualizado_em: '2026-10-23T12:00:01+00:00' }), true);
  // Formatos diferentes do mesmo instante (Postgres x JS): empate não sobrescreve o local.
  assert.equal(remotoVence(local, { atualizado_em: '2026-10-23T12:00:00+00:00' }), false);
});

test('conversão local ⇄ servidor só leva colunas conhecidas', () => {
  const local = {
    id: 'c1', tipo: 'despesa', nome: 'Luz', valor_centavos: 100, dia_vencimento: 5, categoria: 'Moradia',
    ativa: 1, atualizado_em: '2026-10-23T12:00:00.000Z', excluido: 0, sujo: 1, lixo: 'x',
  };
  const enviado = paraServidor('contas_fixas', local);
  assert.equal(enviado.ativa, true);
  assert.equal(enviado.excluido, false);
  assert.ok(!('sujo' in enviado) && !('lixo' in enviado));

  const recebido = doServidor('contas_fixas', { ...enviado, user_id: 'u', sincronizado_em: 'x', atualizado_em: '2026-10-23T12:00:00+00:00' });
  assert.equal(recebido.ativa, 1);
  assert.equal(recebido.atualizado_em, '2026-10-23T12:00:00.000Z');
  assert.ok(!('user_id' in recebido));
});

test('busca incremental volta 1 minuto por segurança', () => {
  assert.equal(inicioDaBusca(null), '1970-01-01T00:00:00.000Z');
  assert.equal(inicioDaBusca('2026-10-23T12:00:00.000Z'), '2026-10-23T11:59:00.000Z');
});

test('regras de senha', () => {
  assert.match(problemaNaSenha('abc12')!, /8 caracteres/);
  assert.match(problemaNaSenha('somenteletras')!, /letras e números/);
  assert.match(problemaNaSenha('felipe2026x', 'felipe@gmail.com')!, /e-mail/);
  assert.match(problemaNaSenha('12345678a')!, /fácil/);
  assert.equal(problemaNaSenha('Contas!Seguras9', 'felipe@gmail.com'), null);
});

test('PIN: 6 dígitos sem repetição ou sequência', () => {
  for (const ruim of ['12345', '111111', '123456', '654321', '890123', '1234567', '12a456']) assert.equal(pinValido(ruim), false, ruim);
  for (const bom of ['482915', '100293', '777778']) assert.equal(pinValido(bom), true, bom);
});

test('autobloqueio após 1 minuto em segundo plano', () => {
  assert.equal(deveBloquear(null, 1_000_000), false);
  assert.equal(deveBloquear(1_000_000, 1_059_999), false);
  assert.equal(deveBloquear(1_000_000, 1_060_000), true);
});
