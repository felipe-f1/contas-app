import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { CampoSenha, Mensagem } from '../components/formAuth';
import { Botao, Rotulo, estilos } from '../components/ui';
import { trocarSenha } from '../lib/nuvem';
import { problemaNaSenha } from '../lib/regrasSync';
import { useSessao } from '../lib/sessao';

export default function TrocarSenha() {
  const { usuario } = useSessao();
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    setErro(null);
    const problema = problemaNaSenha(nova, usuario?.email);
    if (problema) return setErro(problema);
    if (nova !== confirmacao) return setErro('As senhas novas não conferem.');
    setOcupado(true);
    try {
      await trocarSenha(usuario!.email, atual, nova);
      Alert.alert('Senha alterada ✅');
      router.back();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { gap: 14 }]} keyboardShouldPersistTaps="handled">
      <Rotulo>Senha atual</Rotulo>
      <CampoSenha valor={atual} onChange={setAtual} placeholder="Senha atual" />
      <Rotulo>Nova senha</Rotulo>
      <CampoSenha valor={nova} onChange={setNova} placeholder="Nova senha" nova />
      <CampoSenha valor={confirmacao} onChange={setConfirmacao} placeholder="Repita a nova senha" nova />
      <Mensagem texto={erro} />
      <Botao titulo="Salvar" icone="key-outline" onPress={salvar} desabilitado={ocupado} />
    </ScrollView>
  );
}
