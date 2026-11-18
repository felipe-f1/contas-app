import { type DataISO, formatarData } from './datas.ts';

export type SugestaoPagamento = { rotulo: string; data: DataISO };

/**
 * Datas sugeridas ao marcar uma conta como paga pelo atalho da lista.
 * Conta em dia (vence hoje ou depois): nenhuma pergunta, vale hoje.
 * Conta atrasada: o pagamento pode ter sido no vencimento ou hoje.
 */
export function sugestoesDePagamento(vencimento: DataISO, hoje: DataISO): SugestaoPagamento[] {
  if (vencimento >= hoje) return [];
  return [
    { rotulo: 'Hoje', data: hoje },
    { rotulo: `No vencimento (${formatarData(vencimento)})`, data: vencimento },
  ];
}

/** Pagamento não pode estar no futuro. */
export function dataPagamentoValida(data: DataISO, hoje: DataISO): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && data <= hoje;
}
