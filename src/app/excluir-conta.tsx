import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';

import { CampoSenha, Mensagem } from '../components/formAuth';
import { Botao, Cartao, Rotulo, estilos } from '../components/ui';
import { excluirConta } from '../lib/nuvem';
import { useSessao } from '../lib/sessao';
import { cores } from '../lib/tema';

export default function ExcluirConta() {
  const { usuario, sair } = useSessao();
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function confirmar() {
    setErro(null);
    if (!senha) return setErro('Digite sua senha para confirmar.');
    Alert.alert('Excluir conta definitivamente?', 'Todas as suas contas, lançamentos e preferências serão apagados. Isso não pode ser desfeito.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir tudo', style: 'destructive', onPress: excluir },
    ]);
  }

  async function excluir() {
    setOcupado(true);
    try {
      await excluirConta(usuario!.email, senha);
      // Servidor já apagou tudo; agora limpa o aparelho (dados, PIN, lembretes).
      await sair({ semEnviar: true });
      Alert.alert('Conta excluída', 'Seus dados foram apagados.');
    } catch (e) {
      setErro((e as Error).message);
      setOcupado(false);
    }
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { gap: 14 }]} keyboardShouldPersistTaps="handled">
      <Cartao style={s.alerta}>
        <Text style={s.alertaTitulo}>Isto apaga sua conta para sempre</Text>
        <Text style={s.alertaTexto}>
          Serão excluídos da nuvem e deste celular: contas fixas, lançamentos, preferências e o login {usuario?.email}. Se quiser
          guardar uma cópia antes, use Ajustes → Exportar planilha.
        </Text>
      </Cartao>
      <Rotulo>Confirme com sua senha</Rotulo>
      <CampoSenha valor={senha} onChange={setSenha} placeholder="Senha" />
      <Mensagem texto={erro} />
      <Botao titulo={ocupado ? 'Excluindo…' : 'Excluir minha conta'} variante="perigo" icone="trash-outline" onPress={confirmar} desabilitado={ocupado} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  alerta: { backgroundColor: cores.perigoSuave, borderColor: cores.perigoSuave, gap: 6 },
  alertaTitulo: { fontSize: 16, fontWeight: '800', color: cores.perigo },
  alertaTexto: { fontSize: 14, color: cores.texto, lineHeight: 20 },
});
