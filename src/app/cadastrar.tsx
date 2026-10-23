import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, Text } from 'react-native';

import { CampoCodigo, CampoEmail, CampoSenha, Link, Mensagem, TelaAuth } from '../components/formAuth';
import { Botao } from '../components/ui';
import { cadastrar, confirmarCadastro, entrar, reenviarCodigoCadastro } from '../lib/nuvem';
import { problemaNaSenha } from '../lib/regrasSync';
import { cores } from '../lib/tema';

export default function Cadastrar() {
  const params = useLocalSearchParams<{ email?: string; etapa?: 'codigo' }>();
  const [etapa, setEtapa] = useState<'dados' | 'codigo'>(params.etapa ?? 'dados');
  const [email, setEmail] = useState(params.email ?? '');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setInfo(null);
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const criar = () =>
    executar(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Digite um e-mail válido.');
      const problema = problemaNaSenha(senha, email);
      if (problema) throw new Error(problema);
      if (senha !== confirmacao) throw new Error('As senhas não conferem.');
      const precisaConfirmar = await cadastrar(email, senha);
      if (precisaConfirmar) setEtapa('codigo');
    });

  const confirmar = () => executar(() => confirmarCadastro(email, codigo));

  // Se o e-mail trouxer um link em vez do código, abrir o link já confirma a conta
  // no servidor. Então, ao voltar para o app, tentamos entrar com a senha digitada.
  const entrarAposLink = () =>
    executar(async () => {
      if (!senha) return router.replace({ pathname: '/entrar', params: { email } });
      await entrar(email, senha);
    });

  useEffect(() => {
    if (etapa !== 'codigo' || !senha) return;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') entrar(email, senha).catch(() => {});
    });
    return () => sub.remove();
  }, [etapa, email, senha]);

  if (etapa === 'codigo') {
    return (
      <TelaAuth titulo="Confirme seu e-mail" subtitulo={`Enviamos um e-mail para ${email}. Digite o código ou toque no link do e-mail e volte para cá.`}>
        <CampoCodigo valor={codigo} onChange={setCodigo} />
        <Mensagem texto={erro} />
        <Mensagem texto={info} tipo="info" />
        <Botao titulo="Confirmar" icone="checkmark" onPress={confirmar} desabilitado={ocupado || codigo.length < 6} />
        <Botao titulo="Já confirmei pelo link do e-mail" variante="secundario" icone="link-outline" onPress={entrarAposLink} desabilitado={ocupado} />
        <Link
          texto="Reenviar código"
          onPress={() => executar(async () => { await reenviarCodigoCadastro(email); setInfo('Novo código enviado.'); })}
        />
        <Link texto="Voltar" onPress={() => router.back()} />
      </TelaAuth>
    );
  }

  const problema = senha ? problemaNaSenha(senha, email) : null;
  return (
    <TelaAuth titulo="Criar conta" subtitulo="Seus dados ficam criptografados no celular e protegidos na nuvem">
      <CampoEmail valor={email} onChange={setEmail} />
      <CampoSenha valor={senha} onChange={setSenha} placeholder="Senha (mín. 8, letras e números)" nova />
      {!!senha && (
        <Text style={{ color: problema ? cores.alerta : cores.primaria, fontSize: 13, marginTop: -6 }}>
          {problema ?? '✓ Senha forte o suficiente'}
        </Text>
      )}
      <CampoSenha valor={confirmacao} onChange={setConfirmacao} placeholder="Repita a senha" nova />
      <Mensagem texto={erro} />
      <Botao titulo={ocupado ? 'Criando…' : 'Criar conta'} icone="person-add-outline" onPress={criar} desabilitado={ocupado} />
      <Link texto="Já tenho conta" onPress={() => router.back()} />
    </TelaAuth>
  );
}
