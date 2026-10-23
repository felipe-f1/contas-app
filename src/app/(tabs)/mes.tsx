import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ItemLancamento } from '../../components/ItemLancamento';
import { BotaoFlutuante, Cartao, TituloSecao, Vazio, estilos } from '../../components/ui';
import { hojeISO, mesAtual, nomeMes, somarMeses } from '../../lib/datas';
import { type Lancamento, alternarPago, gerarMes, listarLancamentosDoMes } from '../../lib/db';
import { formatarBRL } from '../../lib/dinheiro';
import { sincronizar } from '../../lib/sincronizar';
import { categoria, cores } from '../../lib/tema';

export default function Mes() {
  const db = useSQLiteContext();
  const [mes, setMes] = useState(mesAtual());
  const [itens, setItens] = useState<Lancamento[]>([]);
  const hoje = hojeISO();

  const carregar = useCallback(async () => {
    await gerarMes(db, mes);
    setItens(await listarLancamentosDoMes(db, mes));
  }, [db, mes]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function onAlternarPago(l: Lancamento) {
    await alternarPago(db, l);
    await carregar();
    sincronizar(db);
  }

  const total = itens.reduce((s, l) => s + l.valor_centavos, 0);
  const pago = itens.filter((l) => l.pago_em).reduce((s, l) => s + l.valor_centavos, 0);

  const porCategoria = Object.entries(
    itens.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.categoria]: (acc[l.categoria] ?? 0) + l.valor_centavos }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const maior = porCategoria[0]?.[1] ?? 1;

  return (
    <View style={estilos.tela}>
      <View style={s.seletor}>
        <SetaMes icone="chevron-back" onPress={() => setMes(somarMeses(mes, -1))} rotulo="Mês anterior" />
        <Pressable onPress={() => setMes(mesAtual())} accessibilityHint="Voltar para o mês atual">
          <Text style={s.seletorTexto}>{nomeMes(mes)}</Text>
        </Pressable>
        <SetaMes icone="chevron-forward" onPress={() => setMes(somarMeses(mes, 1))} rotulo="Próximo mês" />
      </View>

      <FlatList
        data={itens}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={estilos.conteudo}
        ListHeaderComponent={
          itens.length > 0 ? (
            <View style={{ gap: 12 }}>
              <Cartao style={s.totais}>
                <Total rotulo="Total" valor={total} />
                <Total rotulo="Pago" valor={pago} cor={cores.primaria} />
                <Total rotulo="A pagar" valor={total - pago} cor={total - pago > 0 ? cores.alerta : cores.textoSuave} />
              </Cartao>

              <Cartao style={{ gap: 10 }}>
                {porCategoria.map(([nome, valor]) => {
                  const cat = categoria(nome);
                  return (
                    <View key={nome} style={{ gap: 4 }}>
                      <View style={s.catLinha}>
                        <Ionicons name={cat.icone} size={16} color={cat.cor} />
                        <Text style={s.catNome}>{nome}</Text>
                        <Text style={s.catValor}>{formatarBRL(valor)}</Text>
                        <Text style={s.catPct}>{Math.round((valor / total) * 100)}%</Text>
                      </View>
                      <View style={s.barra}>
                        <View style={[s.barraCheia, { width: `${(valor / maior) * 100}%`, backgroundColor: cat.cor }]} />
                      </View>
                    </View>
                  );
                })}
              </Cartao>

              <TituloSecao>Lançamentos</TituloSecao>
            </View>
          ) : undefined
        }
        renderItem={({ item }) => (
          <ItemLancamento
            item={item}
            hoje={hoje}
            onPress={() => router.push(`/lancamento/${item.id}`)}
            onAlternarPago={() => onAlternarPago(item)}
          />
        )}
        ListEmptyComponent={
          <Vazio icone="receipt-outline" titulo="Nenhum lançamento neste mês" texto="Toque no + para registrar um gasto ou uma conta." />
        }
      />
      <BotaoFlutuante onPress={() => router.push({ pathname: '/lancamento/[id]', params: { id: 'novo', mes } })} />
    </View>
  );
}

function SetaMes({ icone, onPress, rotulo }: { icone: 'chevron-back' | 'chevron-forward'; onPress: () => void; rotulo: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel={rotulo} style={s.seta}>
      <Ionicons name={icone} size={22} color={cores.primaria} />
    </Pressable>
  );
}

function Total({ rotulo, valor, cor = cores.texto }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={s.totalRotulo}>{rotulo}</Text>
      <Text style={[s.totalValor, { color: cor }]} adjustsFontSizeToFit numberOfLines={1}>
        {formatarBRL(valor)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  seletor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: cores.superficie,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  seletorTexto: { fontSize: 17, fontWeight: '700', color: cores.texto },
  seta: { padding: 6, borderRadius: 20, backgroundColor: cores.primariaSuave },
  totais: { flexDirection: 'row', gap: 12 },
  totalRotulo: { fontSize: 13, color: cores.textoSuave, fontWeight: '600' },
  totalValor: { fontSize: 17, fontWeight: '800' },
  catLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catNome: { flex: 1, fontSize: 14, color: cores.texto },
  catValor: { fontSize: 14, fontWeight: '700', color: cores.texto },
  catPct: { width: 40, textAlign: 'right', fontSize: 13, color: cores.textoSuave },
  barra: { height: 6, borderRadius: 3, backgroundColor: cores.fundo, overflow: 'hidden' },
  barraCheia: { height: 6, borderRadius: 3 },
});
