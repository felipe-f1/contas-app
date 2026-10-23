import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { GraficoMeses } from '../../components/GraficoMeses';
import { ItemLancamento } from '../../components/ItemLancamento';
import { BotaoFlutuante, Cartao, TituloSecao, Vazio, estilos } from '../../components/ui';
import { hojeISO, mesAtual, nomeMes, somarMeses } from '../../lib/datas';
import { type Lancamento, alternarPago, gerarMes, listarLancamentosDoMes, totaisPorMes } from '../../lib/db';
import { formatarBRL } from '../../lib/dinheiro';
import { type PontoSerie, montarSerie, resumir } from '../../lib/relatorios';
import { sincronizar } from '../../lib/sincronizar';
import { categoria, cores } from '../../lib/tema';

const MESES_GRAFICO = 6;

export default function Mes() {
  const db = useSQLiteContext();
  const [mes, setMes] = useState(mesAtual());
  const [itens, setItens] = useState<Lancamento[]>([]);
  const [serie, setSerie] = useState<PontoSerie[]>([]);
  const hoje = hojeISO();

  const carregar = useCallback(async () => {
    await gerarMes(db, mes);
    setItens(await listarLancamentosDoMes(db, mes));
    // O gráfico termina no mês aberto (ou no atual, se você estiver olhando o futuro).
    const fim = mes > mesAtual() ? mes : mesAtual();
    const inicio = somarMeses(fim, -(MESES_GRAFICO - 1));
    setSerie(montarSerie(await totaisPorMes(db, inicio, fim), fim, MESES_GRAFICO));
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

  const r = resumir(itens);
  const maior = r.porCategoria[0]?.[1] ?? 1;

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
          <View style={{ gap: 12 }}>
            {itens.length > 0 && (
              <Cartao style={{ gap: 14 }}>
                <View style={s.totais}>
                  <Total rotulo="Receitas" valor={r.receitas} cor={cores.primaria} />
                  <Total rotulo="Despesas" valor={r.despesas} cor={cores.perigo} />
                  <Total rotulo="Saldo" valor={r.saldo} cor={r.saldo >= 0 ? cores.primaria : cores.perigo} />
                </View>
                {r.qtdDespesas > 0 && (
                  <View style={{ gap: 6 }}>
                    <View style={s.barra}>
                      <View style={[s.barraCheia, { width: `${(r.despesasPagas / r.despesas) * 100}%`, backgroundColor: cores.primaria }]} />
                    </View>
                    <Text style={s.legenda}>
                      {formatarBRL(r.despesasPagas)} pago · {formatarBRL(r.despesas - r.despesasPagas)} a pagar
                    </Text>
                  </View>
                )}
              </Cartao>
            )}

            {serie.some((p) => p.receitas || p.despesas) && (
              <Cartao>
                <GraficoMeses serie={serie} mesAtivo={mes} onEscolher={setMes} />
              </Cartao>
            )}

            {r.porCategoria.length > 0 && (
              <Cartao style={{ gap: 10 }}>
                <Text style={s.cartaoTitulo}>Para onde foi o dinheiro</Text>
                {r.porCategoria.map(([nome, valor]) => {
                  const cat = categoria(nome);
                  return (
                    <View key={nome} style={{ gap: 4 }}>
                      <View style={s.catLinha}>
                        <Ionicons name={cat.icone} size={16} color={cat.cor} />
                        <Text style={s.catNome}>{nome}</Text>
                        <Text style={s.catValor}>{formatarBRL(valor)}</Text>
                        <Text style={s.catPct}>{Math.round((valor / r.despesas) * 100)}%</Text>
                      </View>
                      <View style={s.barra}>
                        <View style={[s.barraCheia, { width: `${(valor / maior) * 100}%`, backgroundColor: cat.cor }]} />
                      </View>
                    </View>
                  );
                })}
              </Cartao>
            )}

            {itens.length > 0 && <TituloSecao>Lançamentos</TituloSecao>}
          </View>
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
          <Vazio icone="receipt-outline" titulo="Nenhum lançamento neste mês" texto="Toque no + para registrar um gasto, uma receita ou uma compra parcelada." />
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
  legenda: { fontSize: 13, color: cores.textoSuave },
  cartaoTitulo: { fontSize: 15, fontWeight: '700', color: cores.texto },
  catLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catNome: { flex: 1, fontSize: 14, color: cores.texto },
  catValor: { fontSize: 14, fontWeight: '700', color: cores.texto },
  catPct: { width: 40, textAlign: 'right', fontSize: 13, color: cores.textoSuave },
  barra: { height: 6, borderRadius: 3, backgroundColor: cores.fundo, overflow: 'hidden' },
  barraCheia: { height: 6, borderRadius: 3 },
});
