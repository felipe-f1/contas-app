import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { CampoData, CampoValor, SeletorCategoria } from '../../components/campos';
import { Botao, Rotulo, estilos } from '../../components/ui';
import { type Mes, hojeISO, mesAtual, vencimentoNoMes } from '../../lib/datas';
import { type Lancamento, buscarLancamento, excluirLancamento, salvarLancamento } from '../../lib/db';
import { sincronizar } from '../../lib/sincronizar';
import { cores } from '../../lib/tema';

export default function FormLancamento() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string; mes?: Mes }>();
  const id = params.id === 'novo' ? null : Number(params.id);

  const [original, setOriginal] = useState<Lancamento | null>(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState(0);
  const [cat, setCat] = useState('Outros');
  // Ao criar a partir de outro mês na aba Mês, sugere uma data dentro daquele mês.
  const [vencimento, setVencimento] = useState(() =>
    params.mes && params.mes !== mesAtual() ? vencimentoNoMes(params.mes, new Date().getDate()) : hojeISO(),
  );
  const [pago, setPago] = useState(false);

  useEffect(() => {
    if (id == null) return;
    buscarLancamento(db, id).then((l) => {
      if (!l) return router.back();
      setOriginal(l);
      setDescricao(l.descricao);
      setValor(l.valor_centavos);
      setCat(l.categoria);
      setVencimento(l.vencimento);
      setPago(l.pago_em != null);
    });
  }, [db, id]);

  async function salvar() {
    if (!descricao.trim()) return Alert.alert('Informe uma descrição');
    if (valor <= 0) return Alert.alert('Informe o valor');
    await salvarLancamento(db, id, {
      descricao: descricao.trim(),
      valor_centavos: valor,
      categoria: cat,
      vencimento,
      pago_em: pago ? (original?.pago_em ?? hojeISO()) : null,
    });
    sincronizar(db);
    router.back();
  }

  function excluir() {
    if (id == null) return;
    Alert.alert('Excluir lançamento?', original?.conta_fixa_id ? 'A conta fixa continua valendo nos outros meses.' : undefined, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await excluirLancamento(db, id);
          sincronizar(db);
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id == null ? 'Novo lançamento' : 'Editar lançamento' }} />
      <ScrollView contentContainerStyle={[estilos.conteudo, { gap: 18 }]} keyboardShouldPersistTaps="handled">
        {original?.conta_fixa_id != null && (
          <Text style={s.aviso}>
            Gerado por uma conta fixa. Alterações aqui valem só para este mês. Use isso para ajustar o valor real, como na conta de luz.
          </Text>
        )}
        <View>
          <Rotulo>Descrição</Rotulo>
          <TextInput
            style={estilos.input}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Ex.: Conta de luz, farmácia, IPVA"
            placeholderTextColor={cores.textoSuave}
            autoFocus={id == null}
          />
        </View>
        <View>
          <Rotulo>Valor</Rotulo>
          <CampoValor valor={valor} onChange={setValor} />
        </View>
        <View>
          <Rotulo>Vencimento</Rotulo>
          <CampoData valor={vencimento} onChange={setVencimento} />
        </View>
        <View>
          <Rotulo>Categoria</Rotulo>
          <SeletorCategoria valor={cat} onChange={setCat} />
        </View>
        <View style={s.linha}>
          <Text style={s.linhaTexto}>Já está paga</Text>
          <Switch value={pago} onValueChange={setPago} trackColor={{ true: cores.primaria }} />
        </View>
        <Botao titulo="Salvar" icone="checkmark" onPress={salvar} />
        {id != null && <Botao titulo="Excluir" variante="perigo" icone="trash-outline" onPress={excluir} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  aviso: {
    backgroundColor: cores.alertaSuave,
    color: cores.alerta,
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linhaTexto: { fontSize: 16, fontWeight: '600', color: cores.texto },
});
