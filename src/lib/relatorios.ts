import { type Mes, somarMeses } from './datas.ts';
import type { Lancamento, Tipo } from './db.ts';

type ItemResumo = Pick<Lancamento, 'tipo' | 'valor_centavos' | 'pago_em' | 'categoria'>;

export type Resumo = {
  receitas: number;
  despesas: number;
  saldo: number;
  despesasPagas: number;
  qtdDespesas: number;
  qtdDespesasPagas: number;
  /** Só despesas, da maior para a menor. */
  porCategoria: [string, number][];
};

export function resumir(itens: ItemResumo[]): Resumo {
  const despesas = itens.filter((i) => i.tipo === 'despesa');
  const pagas = despesas.filter((i) => i.pago_em);
  const soma = (lista: ItemResumo[]) => lista.reduce((s, i) => s + i.valor_centavos, 0);
  const porCategoria = new Map<string, number>();
  for (const d of despesas) porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? 0) + d.valor_centavos);

  const receitas = soma(itens.filter((i) => i.tipo === 'receita'));
  return {
    receitas,
    despesas: soma(despesas),
    saldo: receitas - soma(despesas),
    despesasPagas: soma(pagas),
    qtdDespesas: despesas.length,
    qtdDespesasPagas: pagas.length,
    porCategoria: [...porCategoria.entries()].sort((a, b) => b[1] - a[1]),
  };
}

export type PontoSerie = { mes: Mes; receitas: number; despesas: number };

/** Série dos últimos `n` meses terminando em `mesFinal`, com zero nos meses sem dados. */
export function montarSerie(linhas: { mes: Mes; tipo: Tipo; total: number }[], mesFinal: Mes, n: number): PontoSerie[] {
  return Array.from({ length: n }, (_, i) => {
    const mes = somarMeses(mesFinal, i - n + 1);
    const total = (tipo: Tipo) => linhas.find((l) => l.mes === mes && l.tipo === tipo)?.total ?? 0;
    return { mes, receitas: total('receita'), despesas: total('despesa') };
  });
}

// CSV no formato que o Excel brasileiro abre direto: separador ";", vírgula
// decimal, datas dd/mm/aaaa e BOM para os acentos aparecerem certos.
export function gerarCSV(lancamentos: Lancamento[]): string {
  const cabecalho = ['Mês', 'Vencimento', 'Tipo', 'Descrição', 'Categoria', 'Valor', 'Situação', 'Pago em', 'Parcela'];
  const linhas = lancamentos.map((l) => [
    l.mes,
    dataBR(l.vencimento),
    l.tipo === 'receita' ? 'Receita' : 'Despesa',
    l.descricao,
    l.categoria,
    (l.tipo === 'receita' ? '' : '-') + valorBR(l.valor_centavos),
    l.pago_em ? (l.tipo === 'receita' ? 'Recebida' : 'Paga') : 'Pendente',
    l.pago_em ? dataBR(l.pago_em) : '',
    l.parcela_total ? `${l.parcela_num}/${l.parcela_total}` : '',
  ]);
  return '﻿' + [cabecalho, ...linhas].map((cols) => cols.map(campoCSV).join(';')).join('\r\n') + '\r\n';
}

function dataBR(d: string) {
  const [a, m, dia] = d.split('-');
  return `${dia}/${m}/${a}`;
}

function valorBR(centavos: number) {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, '0')}`;
}

function campoCSV(v: string) {
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
