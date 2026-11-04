import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { CampoSenha, Mensagem } from '../components/formAuth';
import { Botao, estilos } from '../components/ui';
import { entrar } from '../lib/nuvem';
import { useSessao } from '../lib/sessao';
import { cores } from '../lib/tema';

/** Entrar de novo no servidor sem sair do app (os dados do aparelho continuam). */
export default function Reconectar() {
  const { usuario, precisaReconectar } = useSessao();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // A sessão voltou (evento SIGNED_IN): fecha a tela.
  useEffect(() => {
    if (enviado && !precisaReconectar) router.back();
  }, [enviado, precisaReconectar]);

  async function confirmar() {
    setErro(null);
    setOcupado(true);
    try {
      await entrar(usuario!.email, senha);
      setEnviado(true);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { gap: 14 }]} keyboardShouldPersistTaps="handled">
      <Text style={s.texto}>
        Sua sessão na nuvem expirou. Seus dados continuam neste celular; digite a senha de {usuario?.email} para voltar a sincronizar.
      </Text>
      <CampoSenha valor={senha} onChange={setSenha} placeholder="Senha" />
      <Mensagem texto={erro} />
      <Botao titulo={ocupado ? 'Entrando…' : 'Entrar e sincronizar'} icone="sync-outline" onPress={confirmar} desabilitado={ocupado || !senha} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  texto: { fontSize: 15, color: cores.texto, lineHeight: 21 },
});
