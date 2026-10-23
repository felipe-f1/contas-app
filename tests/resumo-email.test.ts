/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { montarResumo } from '../supabase/functions/resumo-semanal/resumo.ts';

const d = (descricao: string, vencimento: string, valor_centavos: number, extra = {}) => ({
  tipo: 'despesa' as const, descricao, vencimento, valor_centavos, pago_em: null, ...extra,
});

test('resumo separa atrasadas e da semana, ignorando pagas, receitas e futuras', () => {
  const r = montarResumo(
    [
      d('Luz', '2026-10-20', 15000),
      d('Internet', '2026-10-26', 10000),
      d('Aluguel', '2026-11-01', 150000), // último dia da janela (26/10 + 6)
      d('Cartão', '2026-11-02', 80000), // fora da janela
      d('Água', '2026-10-27', 9000, { pago_em: '2026-10-25' }),
      { ...d('Salário', '2026-10-27', 500000), tipo: 'receita' as const },
    ],
    '2026-10-26',
  );
  assert.deepEqual(r.atrasadas.map((l) => l.descricao), ['Luz']);
  assert.deepEqual(r.semana.map((l) => l.descricao), ['Internet', 'Aluguel']);
  assert.equal(r.assunto, '💸 Contas da semana: 2 a vencer (R$ 1.600,00), 1 atrasada');
  assert.equal(r.vazio, false);
  assert.match(r.html, /Venceu 20\/10 \(há 6 dias\)/);
  assert.match(r.html, /Vence hoje/);
});

test('resumo vazio', () => {
  const r = montarResumo([], '2026-10-26');
  assert.equal(r.vazio, true);
  assert.equal(r.assunto, '✅ Nenhuma conta para esta semana');
});

test('descrição do usuário é escapada no HTML', () => {
  const r = montarResumo([d('<script>alert(1)</script> & "x"', '2026-10-26', 100)], '2026-10-26');
  assert.ok(!r.html.includes('<script>'));
  assert.ok(r.html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;'));
});
