import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { CampoValor, Contador, SeletorCategoria } from '../../components/campos';
import { Botao, Rotulo, estilos } from '../../components/ui';
import { buscarContaFixa, excluirContaFixa, salvarContaFixa } from '../../lib/db';
import { sincronizar } from '../../lib/sincronizar';
import { cores } from '../../lib/tema';

export default function FormContaFixa() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id === 'nova' ? null : Number(params.id);

  const [nome, setNome] = useState('');
  const [valor, setValor] = useState(0);
  const [dia, setDia] = useState(10);
  const [cat, setCat] = useState('Moradia');
  const [ativa, setAtiva] = useState(true);

  useEffect(() => {
    if (id == null) return;
    buscarContaFixa(db, id).then((c) => {
      if (!c) return router.back();
      setNome(c.nome);
      setValor(c.valor_centavos);
      setDia(c.dia_vencimento);
      setCat(c.categoria);
      setAtiva(!!c.ativa);
    });
  }, [db, id]);

  async function salvar() {
    if (!nome.trim()) return Alert.alert('Informe o nome da conta');
    await salvarContaFixa(db, id, {
      nome: nome.trim(),
      valor_centavos: valor,
      dia_vencimento: dia,
      categoria: cat,
      ativa: ativa ? 1 : 0,
    });
    sincronizar(db);
    router.back();
  }

  function excluir() {
    if (id == null) return;
    Alert.alert('Excluir conta fixa?', 'Os lançamentos já pagos continuam no histórico. Os pendentes serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await excluirContaFixa(db, id);
          sincronizar(db);
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: id == null ? 'Nova conta fixa' : 'Editar conta fixa' }} />
      <ScrollView contentContainerStyle={[estilos.conteudo, { gap: 18 }]} keyboardShouldPersistTaps="handled">
        <View>
          <Rotulo>Nome</Rotulo>
          <TextInput
            style={estilos.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Ex.: Aluguel, Internet, Cartão Nubank"
            placeholderTextColor={cores.textoSuave}
            autoFocus={id == null}
          />
        </View>
        <View>
          <Rotulo>Valor mensal</Rotulo>
          <CampoValor valor={valor} onChange={setValor} />
          <Text style={s.dica}>Se o valor varia (luz, cartão), coloque uma estimativa e ajuste o valor real no mês.</Text>
        </View>
        <View style={s.linha}>
          <Text style={s.linhaTexto}>Vence todo dia</Text>
          <Contador valor={dia} min={1} max={31} onChange={setDia} />
        </View>
        {dia > 28 && <Text style={s.dica}>Em meses mais curtos, o vencimento cai no último dia do mês.</Text>}
        <View>
          <Rotulo>Categoria</Rotulo>
          <SeletorCategoria valor={cat} onChange={setCat} />
        </View>
        {id != null && (
          <View style={s.linha}>
            <View style={{ flex: 1 }}>
              <Text style={s.linhaTexto}>Ativa</Text>
              <Text style={s.dica}>Pause, por exemplo, uma assinatura cancelada sem perder o histórico.</Text>
            </View>
            <Switch value={ativa} onValueChange={setAtiva} trackColor={{ true: cores.primaria }} />
          </View>
        )}
        <Botao titulo="Salvar" icone="checkmark" onPress={salvar} />
        {id != null && <Botao titulo="Excluir" variante="perigo" icone="trash-outline" onPress={excluir} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  dica: { fontSize: 13, color: cores.textoSuave, marginTop: 6, lineHeight: 18 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  linhaTexto: { fontSize: 16, fontWeight: '600', color: cores.texto },
});
