import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Mes } from '../lib/datas';
import { formatarBRL } from '../lib/dinheiro';
import type { PontoSerie } from '../lib/relatorios';
import { cores } from '../lib/tema';

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ALTURA = 120;

/** Barras de receitas x despesas por mês. Toque num mês para abri-lo. */
export function GraficoMeses({ serie, mesAtivo, onEscolher }: { serie: PontoSerie[]; mesAtivo: Mes; onEscolher: (m: Mes) => void }) {
  const maximo = Math.max(1, ...serie.flatMap((p) => [p.receitas, p.despesas]));
  const media = serie.filter((p) => p.despesas > 0);
  const mediaDespesas = media.length ? media.reduce((s, p) => s + p.despesas, 0) / media.length : 0;

  return (
    <View style={{ gap: 10 }}>
      <View style={s.grafico}>
        {serie.map((p) => {
          const ativo = p.mes === mesAtivo;
          return (
            <Pressable
              key={p.mes}
              onPress={() => onEscolher(p.mes)}
              style={s.coluna}
              accessibilityRole="button"
              accessibilityLabel={`${MESES_CURTOS[Number(p.mes.slice(5)) - 1]}: receitas ${formatarBRL(p.receitas)}, despesas ${formatarBRL(p.despesas)}`}
            >
              <View style={s.barras}>
                <View style={[s.barra, { height: (p.receitas / maximo) * ALTURA, backgroundColor: cores.primaria }]} />
                <View style={[s.barra, { height: (p.despesas / maximo) * ALTURA, backgroundColor: cores.perigo }]} />
              </View>
              <Text style={[s.mes, ativo && s.mesAtivo]}>{MESES_CURTOS[Number(p.mes.slice(5)) - 1]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={s.legenda}>
        <Legenda cor={cores.primaria} texto="Receitas" />
        <Legenda cor={cores.perigo} texto="Despesas" />
        {mediaDespesas > 0 && <Text style={s.media}>Média de gastos: {formatarBRL(mediaDespesas)}</Text>}
      </View>
    </View>
  );
}

function Legenda({ cor, texto }: { cor: string; texto: string }) {
  return (
    <View style={s.legendaItem}>
      <View style={[s.ponto, { backgroundColor: cor }]} />
      <Text style={s.legendaTexto}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  grafico: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  coluna: { flex: 1, alignItems: 'center', gap: 6 },
  barras: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: ALTURA },
  barra: { width: 10, borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  mes: { fontSize: 12, color: cores.textoSuave },
  mesAtivo: { color: cores.texto, fontWeight: '800' },
  legenda: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ponto: { width: 10, height: 10, borderRadius: 5 },
  legendaTexto: { fontSize: 13, color: cores.textoSuave },
  media: { fontSize: 13, color: cores.textoSuave, marginLeft: 'auto' },
});
