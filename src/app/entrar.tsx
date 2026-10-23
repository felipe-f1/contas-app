import { router } from 'expo-router';
import { useState } from 'react';

import { CampoEmail, CampoSenha, Link, Mensagem, TelaAuth } from '../components/formAuth';
import { Botao } from '../components/ui';
import { entrar } from '../lib/nuvem';

export default function Entrar() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    setErro(null);
    if (!email || !senha) return setErro('Preencha e-mail e senha.');
    setOcupado(true);
    try {
      await entrar(email, senha);
      // A navegação acontece sozinha: a sessão muda e as rotas protegidas se reorganizam.
    } catch (e) {
      setErro((e as Error).message);
      if (/Confirme seu e-mail/.test((e as Error).message)) {
        router.push({ pathname: '/cadastrar', params: { email, etapa: 'codigo' } });
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <TelaAuth titulo="Contas em Dia" subtitulo="Entre para ver suas contas a pagar">
      <CampoEmail valor={email} onChange={setEmail} />
      <CampoSenha valor={senha} onChange={setSenha} />
      <Mensagem texto={erro} />
      <Botao titulo={ocupado ? 'Entrando…' : 'Entrar'} icone="log-in-outline" onPress={enviar} desabilitado={ocupado} />
      <Link texto="Esqueci minha senha" onPress={() => router.push({ pathname: '/recuperar', params: { email } })} />
      <Botao titulo="Criar conta" variante="secundario" onPress={() => router.push({ pathname: '/cadastrar', params: { email } })} />
    </TelaAuth>
  );
}
