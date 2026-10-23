import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { ItemLancamento } from '../../components/ItemLancamento';
import { BotaoFlutuante, Cartao, TituloSecao, Vazio, estilos } from '../../components/ui';
import { hojeISO, mesAtual, nomeMes, somarDias } from '../../lib/datas';
import { type Lancamento, alternarPago, listarLancamentosDoMes, listarPendentes } from '../../lib/db';
import { formatarBRL } from '../../lib/dinheiro';
import { sincronizar } from '../../lib/sincronizar';
import { cores } from '../../lib/tema';

type Resumo = { pendente: number; pago: number; qtdPagas: number; qtdTotal: number };

export default function APagar() {
  const db = useSQLiteContext();
  const [pendentes, setPendentes] = useState<Lancamento[]>([]);
  const [resumo, setResumo] = useState<Resumo>({ pendente: 0, pago: 0, qtdPagas: 0, qtdTotal: 0 });
  const hoje = hojeISO();

  const carregar = useCallback(async () => {
    setPendentes(await listarPendentes(db, somarDias(hojeISO(), 30)));
    const doMes = await listarLancamentosDoMes(db, mesAtual());
    const pagas = doMes.filter((l) => l.pago_em);
    setResumo({
      pendente: doMes.filter((l) => !l.pago_em).reduce((s, l) => s + l.valor_centavos, 0),
      pago: pagas.reduce((s, l) => s + l.valor_centavos, 0),
      qtdPagas: pagas.length,
      qtdTotal: doMes.length,
    });
  }, [db]);

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

  const emUmaSemana = somarDias(hoje, 7);
  const secoes = [
    { titulo: 'Atrasadas', data: pendentes.filter((l) => l.vencimento < hoje) },
    { titulo: 'Próximos 7 dias', data: pendentes.filter((l) => l.vencimento >= hoje && l.vencimento <= emUmaSemana) },
    { titulo: 'Próximos 30 dias', data: pendentes.filter((l) => l.vencimento > emUmaSemana) },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={estilos.tela}>
      <SectionList
        sections={secoes}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={estilos.conteudo}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <Cartao style={s.resumo}>
            <Text style={s.resumoRotulo}>Falta pagar em {nomeMes(mesAtual()).toLowerCase()}</Text>
            <Text style={s.resumoValor}>{formatarBRL(resumo.pendente)}</Text>
            {resumo.qtdTotal > 0 && (
              <>
                <View style={s.barra}>
                  <View style={[s.barraCheia, { width: `${(resumo.qtdPagas / resumo.qtdTotal) * 100}%` }]} />
                </View>
                <Text style={s.resumoRodape}>
                  {resumo.qtdPagas} de {resumo.qtdTotal} contas pagas · {formatarBRL(resumo.pago)} já pago
                </Text>
              </>
            )}
          </Cartao>
        }
        renderSectionHeader={({ section }) => (
          <TituloSecao>
            {section.titulo}{' '}
            <Text style={{ color: cores.texto }}>{formatarBRL(section.data.reduce((s, l) => s + l.valor_centavos, 0))}</Text>
          </TituloSecao>
        )}
        renderItem={({ item }) => (
          <ItemLancamento
            item={item}
            hoje={hoje}
            onPress={() => router.push(`/lancamento/${item.id}`)}
            onAlternarPago={() => onAlternarPago(item)}
          />
        )}
        ListEmptyComponent={
          <Vazio
            icone="checkmark-done-circle-outline"
            titulo="Nada para pagar nos próximos 30 dias 🎉"
            texto="Cadastre suas contas recorrentes na aba Contas fixas (aluguel, luz, internet...) e o app avisa você antes de cada vencimento."
          />
        }
      />
      <BotaoFlutuante onPress={() => router.push('/lancamento/novo')} />
    </View>
  );
}

const s = StyleSheet.create({
  resumo: { backgroundColor: cores.primaria, borderColor: cores.primaria, gap: 4 },
  resumoRotulo: { color: '#D4EEE8', fontSize: 14, fontWeight: '600' },
  resumoValor: { color: '#fff', fontSize: 32, fontWeight: '800' },
  barra: { height: 6, borderRadius: 3, backgroundColor: '#ffffff40', marginTop: 8, overflow: 'hidden' },
  barraCheia: { height: 6, backgroundColor: '#fff' },
  resumoRodape: { color: '#D4EEE8', fontSize: 13, marginTop: 6 },
});
