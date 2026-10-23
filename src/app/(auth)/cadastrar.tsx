import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { CampoCodigo, CampoEmail, CampoSenha, Link, Mensagem, TelaAuth } from '../../components/formAuth';
import { Botao } from '../../components/ui';
import { cadastrar, confirmarCadastro, reenviarCodigoCadastro } from '../../lib/nuvem';
import { problemaNaSenha } from '../../lib/regrasSync';
import { cores } from '../../lib/tema';

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

  if (etapa === 'codigo') {
    return (
      <TelaAuth titulo="Confirme seu e-mail" subtitulo={`Enviamos um código para ${email}`}>
        <CampoCodigo valor={codigo} onChange={setCodigo} />
        <Mensagem texto={erro} />
        <Mensagem texto={info} tipo="info" />
        <Botao titulo="Confirmar" icone="checkmark" onPress={confirmar} desabilitado={ocupado || codigo.length < 6} />
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
