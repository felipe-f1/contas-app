import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { type DataISO, deDate, paraDate } from '../lib/datas';
import { centavosDeDigitos, formatarBRL } from '../lib/dinheiro';
import type { Tipo } from '../lib/db';
import { categoriasDo, cores } from '../lib/tema';
import { estilos } from './ui';

export function CampoValor({ valor, onChange }: { valor: number; onChange: (centavos: number) => void }) {
  return (
    <TextInput
      style={[estilos.input, s.valor]}
      keyboardType="number-pad"
      value={formatarBRL(valor)}
      onChangeText={(t) => onChange(centavosDeDigitos(t))}
      accessibilityLabel="Valor"
      selectTextOnFocus
    />
  );
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function CampoData({ valor, onChange }: { valor: DataISO; onChange: (d: DataISO) => void }) {
  const [aberto, setAberto] = useState(false);
  const data = paraDate(valor);
  const [a, m, d] = valor.split('-');

  return (
    <View>
      <Pressable style={[estilos.input, s.linha]} onPress={() => setAberto((v) => !v)} accessibilityRole="button">
        <Ionicons name="calendar-outline" size={20} color={cores.primaria} />
        <Text style={s.dataTexto}>
          {d}/{m}/{a} <Text style={{ color: cores.textoSuave }}>({DIAS_SEMANA[data.getDay()]})</Text>
        </Text>
      </Pressable>
      {aberto && (
        <DateTimePicker
          value={data}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onValueChange={(_, nova) => {
            if (Platform.OS === 'android') setAberto(false);
            onChange(deDate(nova));
          }}
          onDismiss={() => setAberto(false)}
        />
      )}
    </View>
  );
}

export function SeletorTipo({ valor, onChange }: { valor: Tipo; onChange: (t: Tipo) => void }) {
  const opcoes: { tipo: Tipo; rotulo: string; cor: string }[] = [
    { tipo: 'despesa', rotulo: 'Despesa', cor: cores.perigo },
    { tipo: 'receita', rotulo: 'Receita', cor: cores.primaria },
  ];
  return (
    <View style={s.segmentos}>
      {opcoes.map((o) => {
        const ativo = o.tipo === valor;
        return (
          <Pressable
            key={o.tipo}
            onPress={() => onChange(o.tipo)}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
            style={[s.segmento, ativo && { backgroundColor: o.cor }]}
          >
            <Text style={[s.segmentoTexto, ativo && { color: '#fff' }]}>{o.rotulo}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SeletorCategoria({ tipo, valor, onChange }: { tipo: Tipo; valor: string; onChange: (c: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
      {categoriasDo(tipo).map((c) => {
        const ativo = c.nome === valor;
        return (
          <Pressable
            key={c.nome}
            onPress={() => onChange(c.nome)}
            accessibilityRole="radio"
            accessibilityState={{ selected: ativo }}
            style={[s.chip, ativo && { backgroundColor: c.cor, borderColor: c.cor }]}
          >
            <Ionicons name={c.icone} size={16} color={ativo ? '#fff' : c.cor} />
            <Text style={[s.chipTexto, ativo && { color: '#fff' }]}>{c.nome}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Contador({
  valor,
  onChange,
  min,
  max,
  formatar = String,
}: {
  valor: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  formatar?: (n: number) => string;
}) {
  return (
    <View style={s.contador}>
      <BotaoRedondo icone="remove" onPress={() => onChange(Math.max(min, valor - 1))} desabilitado={valor <= min} />
      <Text style={s.contadorValor}>{formatar(valor)}</Text>
      <BotaoRedondo icone="add" onPress={() => onChange(Math.min(max, valor + 1))} desabilitado={valor >= max} />
    </View>
  );
}

function BotaoRedondo({ icone, onPress, desabilitado }: { icone: 'add' | 'remove'; onPress: () => void; desabilitado: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={icone === 'add' ? 'Aumentar' : 'Diminuir'}
      style={[s.redondo, desabilitado && { opacity: 0.35 }]}
    >
      <Ionicons name={icone} size={20} color={cores.primaria} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  valor: { fontSize: 24, fontWeight: '700' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dataTexto: { fontSize: 16, color: cores.texto },
  chips: { gap: 8, paddingVertical: 2 },
  segmentos: {
    flexDirection: 'row',
    backgroundColor: cores.superficie,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    padding: 4,
    gap: 4,
  },
  segmento: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  segmentoTexto: { fontSize: 15, fontWeight: '700', color: cores.textoSuave },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  chipTexto: { fontSize: 14, color: cores.texto, fontWeight: '500' },
  contador: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contadorValor: { minWidth: 72, textAlign: 'center', fontSize: 17, fontWeight: '700', color: cores.texto },
  redondo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: cores.primariaSuave,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
