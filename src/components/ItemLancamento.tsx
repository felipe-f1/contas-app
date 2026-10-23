import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { descreverPrazo, diasEntre, formatarData } from '../lib/datas';
import type { Lancamento } from '../lib/db';
import { formatarBRL } from '../lib/dinheiro';
import { categoria, cores } from '../lib/tema';

export function ItemLancamento({
  item,
  hoje,
  onPress,
  onAlternarPago,
}: {
  item: Lancamento;
  hoje: string;
  onPress: () => void;
  onAlternarPago: () => void;
}) {
  const cat = categoria(item.categoria);
  const receita = item.tipo === 'receita';
  const pago = item.pago_em != null;
  const dias = diasEntre(hoje, item.vencimento);
  const corPrazo = pago || receita ? cores.primaria : dias < 0 ? cores.perigo : dias <= 3 ? cores.alerta : cores.textoSuave;
  const prazo = pago
    ? `${receita ? 'Recebida' : 'Paga'} em ${formatarData(item.pago_em!)}`
    : receita
      ? `Previsto para ${formatarData(item.vencimento)}`
      : `${descreverPrazo(item.vencimento, hoje)} · ${formatarData(item.vencimento)}`;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.item, pressed && { opacity: 0.7 }]} accessibilityRole="button">
      <View style={[s.icone, { backgroundColor: `${cat.cor}1A` }]}>
        <Ionicons name={cat.icone} size={20} color={cat.cor} />
      </View>
      <View style={s.meio}>
        <Text style={[s.descricao, pago && s.riscado]} numberOfLines={1}>
          {item.descricao}
          {!!item.parcela_total && <Text style={s.parcela}> ({item.parcela_num}/{item.parcela_total})</Text>}
        </Text>
        <Text style={[s.prazo, { color: corPrazo }]}>{prazo}</Text>
      </View>
      <Text style={[s.valor, receita && { color: cores.primaria }, pago && !receita && { color: cores.textoSuave }]}>
        {receita ? '+' : ''}
        {formatarBRL(item.valor_centavos)}
      </Text>
      <Pressable
        onPress={onAlternarPago}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: pago }}
        accessibilityLabel={receita ? (pago ? 'Marcar como não recebida' : 'Marcar como recebida') : pago ? 'Marcar como não paga' : 'Marcar como paga'}
      >
        <Ionicons
          name={pago ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={pago ? cores.primaria : cores.borda}
        />
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.superficie,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
  icone: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  meio: { flex: 1, gap: 2 },
  descricao: { fontSize: 16, fontWeight: '600', color: cores.texto },
  riscado: { textDecorationLine: 'line-through', color: cores.textoSuave },
  prazo: { fontSize: 13, fontWeight: '500' },
  parcela: { fontSize: 13, fontWeight: '500', color: cores.textoSuave },
  valor: { fontSize: 15, fontWeight: '700', color: cores.texto },
});
