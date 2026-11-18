import { router } from 'expo-router';
import { Alert } from 'react-native';

import type { DataISO } from '../lib/datas';
import type { Lancamento } from '../lib/db';
import { sugestoesDePagamento } from '../lib/pagamento';

/**
 * Atalho do ✓ na lista. Conta em dia: marca hoje. Conta atrasada: pergunta
 * se foi paga hoje, no vencimento ou em outra data (abre o formulário).
 * Se já está paga, desfaz.
 */
export function marcarPagoComData(l: Lancamento, hoje: DataISO, aplicar: (pagoEm?: DataISO) => Promise<void>) {
  if (l.pago_em) return aplicar();
  const sugestoes = sugestoesDePagamento(l.vencimento, hoje);
  if (sugestoes.length === 0) return aplicar(hoje);

  Alert.alert(
    l.tipo === 'receita' ? 'Quando foi recebido?' : 'Quando foi pago?',
    l.descricao,
    [
      ...sugestoes.map((s) => ({ text: s.rotulo, onPress: () => aplicar(s.data) })),
      {
        text: 'Outra data',
        onPress: () => router.push({ pathname: '/lancamento/[id]', params: { id: l.id, pagar: '1' } }),
      },
    ],
    { cancelable: true },
  );
}
