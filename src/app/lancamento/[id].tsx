import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { CampoData, CampoValor, Contador, SeletorCategoria, SeletorTipo } from '../../components/campos';
import { Botao, Rotulo, estilos } from '../../components/ui';
import { type Mes, hojeISO, mesAtual, vencimentoNoMes } from '../../lib/datas';
import {
  type Lancamento,
  type Tipo,
  buscarLancamento,
  criarParcelado,
  excluirLancamento,
  excluirParcelasDesde,
  salvarLancamento,
} from '../../lib/db';
import { formatarBRL } from '../../lib/dinheiro';
import { sincronizar } from '../../lib/sincronizar';
import { categoriasDo, cores } from '../../lib/tema';

export default function FormLancamento() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ id: string; mes?: Mes }>();
  const id = params.id === 'novo' ? null : params.id;

  const [original, setOriginal] = useState<Lancamento | null>(null);
  const [tipo, setTipo] = useState<Tipo>('despesa');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState(0);
  const [cat, setCat] = useState('Outros');
  // Ao criar a partir de outro mês na aba Mês, sugere uma data dentro daquele mês.
  const [vencimento, setVencimento] = useState(() =>
    params.mes && params.mes !== mesAtual() ? vencimentoNoMes(params.mes, new Date().getDate()) : hojeISO(),
  );
  const [pago, setPago] = useState(false);
  const [parcelado, setParcelado] = useState(false);
  const [parcelas, setParcelas] = useState(2);

  const receita = tipo === 'receita';

  useEffect(() => {
    if (id == null) return;
    buscarLancamento(db, id).then((l) => {
      if (!l) return router.back();
      setOriginal(l);
      setTipo(l.tipo);
      setDescricao(l.descricao);
      setValor(l.valor_centavos);
      setCat(l.categoria);
      setVencimento(l.vencimento);
      setPago(l.pago_em != null);
    });
  }, [db, id]);

  function trocarTipo(novo: Tipo) {
    setTipo(novo);
    if (!categoriasDo(novo).some((c) => c.nome === cat)) setCat(categoriasDo(novo)[0].nome);
    if (novo === 'receita') setParcelado(false);
  }

  async function salvar() {
    if (!descricao.trim()) return Alert.alert('Informe uma descrição');
    if (valor <= 0) return Alert.alert('Informe o valor');
    const dados = {
      tipo,
      descricao: descricao.trim(),
      valor_centavos: valor,
      categoria: cat,
      vencimento,
      pago_em: pago ? (original?.pago_em ?? hojeISO()) : null,
    };
    if (id == null && parcelado) await criarParcelado(db, dados, parcelas);
    else await salvarLancamento(db, id, dados);
    sincronizar(db);
    router.back();
  }

  async function concluirExclusao(acao: () => Promise<unknown>) {
    await acao();
    sincronizar(db);
    router.back();
  }

  function excluir() {
    if (id == null || !original) return;
    if (original.parcela_grupo && original.parcela_num! < original.parcela_total!) {
      Alert.alert('Excluir parcela', `Esta é a parcela ${original.parcela_num} de ${original.parcela_total}.`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Só esta', onPress: () => concluirExclusao(() => excluirLancamento(db, id)) },
        { text: 'Esta e as próximas', style: 'destructive', onPress: () => concluirExclusao(() => excluirParcelasDesde(db, original)) },
      ]);
      return;
    }
    Alert.alert('Excluir lançamento?', original.conta_fixa_id ? 'A conta fixa continua valendo nos outros meses.' : undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => concluirExclusao(() => excluirLancamento(db, id)) },
    ]);
  }

  const titulo = id == null ? (receita ? 'Nova receita' : 'Nova despesa') : receita ? 'Editar receita' : 'Editar despesa';

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: titulo }} />
      <ScrollView contentContainerStyle={[estilos.conteudo, { gap: 18 }]} keyboardShouldPersistTaps="handled">
        {original?.conta_fixa_id != null && (
          <Text style={s.aviso}>
            Gerado por uma conta fixa. Alterações aqui valem só para este mês. Use isso para ajustar o valor real, como na conta de luz.
          </Text>
        )}
        {original?.parcela_grupo != null && (
          <Text style={s.aviso}>
            Parcela {original.parcela_num} de {original.parcela_total}. Alterações aqui valem só para esta parcela.
          </Text>
        )}
        {original?.parcela_grupo == null && <SeletorTipo valor={tipo} onChange={trocarTipo} />}
        <View>
          <Rotulo>Descrição</Rotulo>
          <TextInput
            style={estilos.input}
            value={descricao}
            onChangeText={setDescricao}
            placeholder={receita ? 'Ex.: Salário, freela, venda' : 'Ex.: Conta de luz, farmácia, TV nova'}
            placeholderTextColor={cores.textoSuave}
            autoFocus={id == null}
          />
        </View>
        {id == null && !receita && (
          <View style={s.linha}>
            <Text style={s.linhaTexto}>Compra parcelada</Text>
            <Switch value={parcelado} onValueChange={setParcelado} trackColor={{ true: cores.primaria }} />
          </View>
        )}
        {parcelado && (
          <View style={s.linha}>
            <Text style={s.linhaTexto}>Número de parcelas</Text>
            <Contador valor={parcelas} min={2} max={48} onChange={setParcelas} formatar={(n) => `${n}x`} />
          </View>
        )}
        <View>
          <Rotulo>{parcelado ? 'Valor de cada parcela' : 'Valor'}</Rotulo>
          <CampoValor valor={valor} onChange={setValor} />
          {parcelado && valor > 0 && (
            <Text style={s.dica}>
              Total da compra: {formatarBRL(valor * parcelas)} em {parcelas}x de {formatarBRL(valor)}
            </Text>
          )}
        </View>
        <View>
          <Rotulo>{parcelado ? 'Vencimento da 1ª parcela' : receita ? 'Data prevista' : 'Vencimento'}</Rotulo>
          <CampoData valor={vencimento} onChange={setVencimento} />
          {parcelado && <Text style={s.dica}>As próximas parcelas vencem no mesmo dia dos meses seguintes.</Text>}
        </View>
        <View>
          <Rotulo>Categoria</Rotulo>
          <SeletorCategoria tipo={tipo} valor={cat} onChange={setCat} />
        </View>
        <View style={s.linha}>
          <Text style={s.linhaTexto}>{receita ? 'Já recebi' : parcelado ? '1ª parcela já está paga' : 'Já está paga'}</Text>
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
  dica: { fontSize: 13, color: cores.textoSuave, marginTop: 6, lineHeight: 18 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  linhaTexto: { fontSize: 16, fontWeight: '600', color: cores.texto, flex: 1 },
});
