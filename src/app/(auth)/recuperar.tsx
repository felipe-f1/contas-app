import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { CampoCodigo, CampoEmail, CampoSenha, Link, Mensagem, TelaAuth } from '../../components/formAuth';
import { Botao } from '../../components/ui';
import { pedirCodigoRecuperacao, redefinirSenha } from '../../lib/nuvem';
import { problemaNaSenha } from '../../lib/regrasSync';

export default function Recuperar() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [etapa, setEtapa] = useState<'email' | 'nova'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const pedir = () =>
    executar(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Digite um e-mail válido.');
      await pedirCodigoRecuperacao(email);
      setEtapa('nova');
    });

  const redefinir = () =>
    executar(async () => {
      const problema = problemaNaSenha(senha, email);
      if (problema) throw new Error(problema);
      await redefinirSenha(email, codigo, senha);
      // Ao redefinir, o usuário já fica logado e as rotas protegidas assumem.
    });

  if (etapa === 'nova') {
    return (
      <TelaAuth titulo="Nova senha" subtitulo={`Se ${email} tiver conta, você recebeu um código.`}>
        <CampoCodigo valor={codigo} onChange={setCodigo} />
        <CampoSenha valor={senha} onChange={setSenha} placeholder="Nova senha" nova />
        <Mensagem texto={erro} />
        <Botao titulo="Salvar nova senha" icone="key-outline" onPress={redefinir} desabilitado={ocupado || codigo.length < 6} />
        <Link texto="Voltar" onPress={() => setEtapa('email')} />
      </TelaAuth>
    );
  }

  return (
    <TelaAuth titulo="Recuperar senha" subtitulo="Enviaremos um código para o seu e-mail">
      <CampoEmail valor={email} onChange={setEmail} />
      <Mensagem texto={erro} />
      <Botao titulo="Enviar código" icone="mail-outline" onPress={pedir} desabilitado={ocupado} />
      <Link texto="Voltar para entrar" onPress={() => router.back()} />
    </TelaAuth>
  );
}
