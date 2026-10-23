import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { BotaoFlutuante, Cartao, Vazio, estilos } from '../../components/ui';
import { type ContaFixa, listarContasFixas } from '../../lib/db';
import { formatarBRL } from '../../lib/dinheiro';
import { categoria, cores } from '../../lib/tema';

export default function Fixas() {
  const db = useSQLiteContext();
  const [contas, setContas] = useState<ContaFixa[]>([]);

  useFocusEffect(
    useCallback(() => {
      listarContasFixas(db).then(setContas);
    }, [db]),
  );

  const ativas = contas.filter((c) => c.ativa);
  const soma = (tipo: string) => ativas.filter((c) => c.tipo === tipo).reduce((s, c) => s + c.valor_centavos, 0);
  const despesas = soma('despesa');
  const receitas = soma('receita');

  return (
    <View style={estilos.tela}>
      <FlatList
        data={contas}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={estilos.conteudo}
        ListHeaderComponent={
          contas.length > 0 ? (
            <Cartao>
              <Text style={s.rotulo}>Despesas fixas por mês</Text>
              <Text style={s.total}>{formatarBRL(despesas)}</Text>
              {receitas > 0 && (
                <Text style={[s.dica, { marginBottom: 4 }]}>
                  Receitas fixas: <Text style={{ color: cores.primaria, fontWeight: '700' }}>{formatarBRL(receitas)}</Text> · sobra{' '}
                  <Text style={{ fontWeight: '700', color: receitas - despesas >= 0 ? cores.primaria : cores.perigo }}>
                    {formatarBRL(receitas - despesas)}
                  </Text>
                </Text>
              )}
              <Text style={s.dica}>Essas contas entram automaticamente em todo mês, com lembrete antes do vencimento.</Text>
            </Cartao>
          ) : undefined
        }
        renderItem={({ item }) => {
          const cat = categoria(item.categoria);
          return (
            <Pressable
              onPress={() => router.push(`/conta/${item.id}`)}
              style={({ pressed }) => [s.item, !item.ativa && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <View style={[s.icone, { backgroundColor: `${cat.cor}1A` }]}>
                <Ionicons name={cat.icone} size={20} color={cat.cor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.nome}>{item.nome}</Text>
                <Text style={s.sub}>
                  {item.ativa ? `Todo dia ${item.dia_vencimento}` : 'Pausada'} · {item.categoria}
                </Text>
              </View>
              <Text style={[s.valor, item.tipo === 'receita' && { color: cores.primaria }]}>
                {item.tipo === 'receita' ? '+' : ''}
                {formatarBRL(item.valor_centavos)}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Vazio
            icone="repeat-outline"
            titulo="Nenhuma conta fixa ainda"
            texto="Comece pelas contas que se repetem todo mês: aluguel, condomínio, luz, água, internet, cartão, escola..."
          />
        }
      />
      <BotaoFlutuante onPress={() => router.push('/conta/nova')} />
    </View>
  );
}

const s = StyleSheet.create({
  rotulo: { fontSize: 14, color: cores.textoSuave, fontWeight: '600' },
  total: { fontSize: 28, fontWeight: '800', color: cores.texto, marginVertical: 2 },
  dica: { fontSize: 13, color: cores.textoSuave, lineHeight: 18 },
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
  nome: { fontSize: 16, fontWeight: '600', color: cores.texto },
  sub: { fontSize: 13, color: cores.textoSuave, marginTop: 2 },
  valor: { fontSize: 15, fontWeight: '700', color: cores.texto },
});
