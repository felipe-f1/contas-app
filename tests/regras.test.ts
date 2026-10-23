/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { descreverPrazo, diasEntre, nomeMes, somarDias, somarMeses, vencimentoNoMes } from '../src/lib/datas.ts';
import { centavosDeDigitos, formatarBRL } from '../src/lib/dinheiro.ts';
import { planejarLembretes } from '../src/lib/planejarLembretes.ts';
import { gerarCSV, montarSerie, resumir } from '../src/lib/relatorios.ts';

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

const base = { conta_fixa_id: null, parcela_grupo: null, parcela_num: null, parcela_total: null, mes: '2026-10' };

test('resumo do mês separa receitas e despesas', () => {
  const r = resumir([
    { tipo: 'receita', valor_centavos: 500000, pago_em: '2026-10-05', categoria: 'Salário' },
    { tipo: 'despesa', valor_centavos: 150000, pago_em: '2026-10-10', categoria: 'Moradia' },
    { tipo: 'despesa', valor_centavos: 20000, pago_em: null, categoria: 'Mercado' },
    { tipo: 'despesa', valor_centavos: 30000, pago_em: null, categoria: 'Mercado' },
  ]);
  assert.equal(r.receitas, 500000);
  assert.equal(r.despesas, 200000);
  assert.equal(r.saldo, 300000);
  assert.equal(r.despesasPagas, 150000);
  assert.equal(r.qtdDespesasPagas, 1);
  assert.deepEqual(r.porCategoria, [['Moradia', 150000], ['Mercado', 50000]]);
});

test('série do gráfico preenche meses vazios e atravessa o ano', () => {
  const serie = montarSerie(
    [
      { mes: '2026-12', tipo: 'despesa', total: 100 },
      { mes: '2027-01', tipo: 'receita', total: 300 },
    ],
    '2027-01',
    3,
  );
  assert.deepEqual(serie, [
    { mes: '2026-11', receitas: 0, despesas: 0 },
    { mes: '2026-12', receitas: 0, despesas: 100 },
    { mes: '2027-01', receitas: 300, despesas: 0 },
  ]);
});

test('CSV no formato do Excel brasileiro', () => {
  const csv = gerarCSV([
    { ...base, id: 1, tipo: 'despesa', descricao: 'Luz; conta "nova"', categoria: 'Luz, água e gás', valor_centavos: 15075, vencimento: '2026-10-05', pago_em: '2026-10-04' },
    { ...base, id: 2, tipo: 'receita', descricao: 'Salário', categoria: 'Salário', valor_centavos: 500000, vencimento: '2026-10-05', pago_em: null, parcela_num: 2, parcela_total: 10 },
  ]);
  const linhas = csv.split('\r\n');
  assert.ok(csv.startsWith('﻿Mês;Vencimento;'));
  assert.equal(linhas[1], '2026-10;05/10/2026;Despesa;"Luz; conta ""nova""";Luz, água e gás;-150,75;Paga;04/10/2026;');
  assert.equal(linhas[2], '2026-10;05/10/2026;Receita;Salário;Salário;5000,00;Pendente;;2/10');
});
