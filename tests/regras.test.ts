/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { descreverPrazo, diasEntre, nomeMes, somarDias, somarMeses, vencimentoNoMes } from '../src/lib/datas.ts';
import { centavosDeDigitos, formatarBRL } from '../src/lib/dinheiro.ts';
import { planejarLembretes } from '../src/lib/planejarLembretes.ts';

test('vencimento no dia 31 cai no último dia de meses curtos', () => {
  assert.equal(vencimentoNoMes('2026-02', 31), '2026-02-28');
  assert.equal(vencimentoNoMes('2028-02', 31), '2028-02-29');
  assert.equal(vencimentoNoMes('2026-04', 31), '2026-04-30');
  assert.equal(vencimentoNoMes('2026-10', 5), '2026-10-05');
});

test('aritmética de meses e dias atravessa a virada do ano', () => {
  assert.equal(somarMeses('2026-12', 1), '2027-01');
  assert.equal(somarMeses('2026-01', -1), '2025-12');
  assert.equal(somarDias('2026-12-30', 3), '2027-01-02');
  assert.equal(diasEntre('2026-10-23', '2026-11-02'), 10);
  assert.equal(nomeMes('2026-10'), 'Outubro de 2026');
});

test('descrição do prazo', () => {
  assert.equal(descreverPrazo('2026-10-23', '2026-10-23'), 'Vence hoje');
  assert.equal(descreverPrazo('2026-10-24', '2026-10-23'), 'Vence amanhã');
  assert.equal(descreverPrazo('2026-10-28', '2026-10-23'), 'Vence em 5 dias');
  assert.equal(descreverPrazo('2026-10-20', '2026-10-23'), 'Venceu há 3 dias');
});

test('formatação e máscara de dinheiro', () => {
  assert.equal(formatarBRL(0), 'R$ 0,00');
  assert.equal(formatarBRL(12345), 'R$ 123,45');
  assert.equal(formatarBRL(123456789), 'R$ 1.234.567,89');
  assert.equal(formatarBRL(-500), '-R$ 5,00');
  assert.equal(centavosDeDigitos('R$ 1.234,56'), 123456);
  assert.equal(centavosDeDigitos(''), 0);
});

test('lembretes: aviso antecipado + no dia, ignorando horários passados', () => {
  const agora = new Date(2026, 9, 23, 10, 0); // 23/10 10h
  const plano = planejarLembretes(
    [
      { descricao: 'Luz', valor_centavos: 15000, vencimento: '2026-10-28' },
      { descricao: 'Água', valor_centavos: 8000, vencimento: '2026-10-23' }, // 9h de hoje já passou
    ],
    { diasAntes: 3, hora: 9 },
    agora,
  );
  assert.equal(plano.length, 2);
  assert.deepEqual(plano[0].quando, new Date(2026, 9, 25, 9, 0));
  assert.equal(plano[0].titulo, '📅 Luz vence em 3 dias (28/10)');
  assert.deepEqual(plano[1].quando, new Date(2026, 9, 28, 9, 0));
  assert.equal(plano[1].titulo, '⚠️ Luz vence hoje');
});

test('lembretes: contas do mesmo dia viram uma notificação só', () => {
  const plano = planejarLembretes(
    [
      { descricao: 'Internet', valor_centavos: 10000, vencimento: '2026-11-10' },
      { descricao: 'Celular', valor_centavos: 5000, vencimento: '2026-11-10' },
    ],
    { diasAntes: 0, hora: 8 },
    new Date(2026, 9, 23),
  );
  assert.equal(plano.length, 1);
  assert.equal(plano[0].titulo, '⚠️ 2 contas vencem hoje');
  assert.equal(plano[0].corpo, 'Internet, Celular — total R$ 150,00');
});

test('lembretes respeitam o limite', () => {
  const pendentes = Array.from({ length: 100 }, (_, i) => ({
    descricao: `Conta ${i}`,
    valor_centavos: 100,
    vencimento: somarDias('2026-11-01', i),
  }));
  assert.equal(planejarLembretes(pendentes, { diasAntes: 2, hora: 9 }, new Date(2026, 9, 23)).length, 60);
});
