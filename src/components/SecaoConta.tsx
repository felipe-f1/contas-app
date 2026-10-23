import Ionicons from '@expo/vector-icons/Ionicons';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { type Config, lerConfig, salvarConfig, salvarPreferencias } from '../lib/db';
import { enviarResumoTeste } from '../lib/nuvem';
import { useSessao } from '../lib/sessao';
import { sincronizar } from '../lib/sincronizar';
import { pendentesDeEnvio } from '../lib/sync';
import { cores } from '../lib/tema';
import { Botao, Cartao, TituloSecao } from './ui';

function formatarMomento(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SecaoConta() {
  const db = useSQLiteContext();
  const { usuario, sair, aplicarProtecaoDeTela } = useSessao();
  const [config, setConfig] = useState<Config | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [temBiometria, setTemBiometria] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    setConfig(await lerConfig(db));
    setPendentes(await pendentesDeEnvio(db));
    setTemBiometria((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );

  async function executar(acao: () => Promise<void>, erro: string) {
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      Alert.alert(erro, e instanceof Error ? e.message : undefined);
    } finally {
      setOcupado(false);
      recarregar();
    }
  }

  const sincronizarAgora = () =>
    executar(async () => {
      await sincronizar(db);
      if ((await pendentesDeEnvio(db)) > 0) throw new Error('Verifique sua conexão com a internet.');
    }, 'Não foi possível sincronizar');

  function confirmarSaida() {
    Alert.alert('Sair da conta?', 'Seus dados continuam guardados na nuvem e são apagados deste celular.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: () =>
          sair().catch(() =>
            Alert.alert(
              'Sem conexão',
              `${pendentes || 'Algumas'} alteração(ões) ainda não foram enviadas e serão perdidas se você sair agora.`,
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Sair mesmo assim', style: 'destructive', onPress: () => sair({ semEnviar: true }) },
              ],
            ),
          ),
      },
    ]);
  }

  async function alternarCapturas(bloquear: boolean) {
    setConfig((c) => (c ? { ...c, bloquearCapturas: bloquear } : c));
    await salvarConfig(db, { bloquearCapturas: bloquear });
    await aplicarProtecaoDeTela(bloquear);
  }

  async function alternarBiometria(ativar: boolean) {
    if (ativar) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirme para ativar a biometria', disableDeviceFallback: true, cancelLabel: 'Cancelar' });
      if (!r.success) return;
    }
    setConfig((c) => (c ? { ...c, biometria: ativar } : c));
    await salvarConfig(db, { biometria: ativar });
  }

  if (!config) return null;

  return (
    <>
      <TituloSecao>Conta</TituloSecao>
      <Cartao style={{ gap: 12 }}>
        <View style={s.linha}>
          <Ionicons name={pendentes ? 'cloud-upload-outline' : 'cloud-done-outline'} size={26} color={pendentes ? cores.alerta : cores.primaria} />
          <View style={{ flex: 1 }}>
            <Text style={s.titulo}>{usuario?.email}</Text>
            <Text style={s.sub}>
              {pendentes
                ? `${pendentes} alteração(ões) aguardando internet`
                : config.ultimaSincronizacao
                  ? `Sincronizado em ${formatarMomento(config.ultimaSincronizacao)}`
                  : 'Ainda não sincronizado'}
            </Text>
          </View>
        </View>
        <Botao titulo="Sincronizar agora" variante="secundario" icone="sync-outline" onPress={sincronizarAgora} desabilitado={ocupado} />
        <Botao titulo="Trocar senha" variante="secundario" icone="key-outline" onPress={() => router.push('/trocar-senha')} />
        <Botao titulo="Sair da conta" variante="perigo" icone="log-out-outline" onPress={confirmarSaida} desabilitado={ocupado} />
        <Text style={s.excluir} onPress={() => router.push('/excluir-conta')} accessibilityRole="link">
          Excluir minha conta e todos os dados
        </Text>
      </Cartao>

      <TituloSecao>Segurança</TituloSecao>
      <Cartao style={{ gap: 14 }}>
        <Linha titulo="Desbloquear com biometria" sub={temBiometria ? 'Digital ou rosto, além do PIN' : 'Cadastre uma digital no celular para usar'}>
          <Switch value={config.biometria && temBiometria} onValueChange={alternarBiometria} disabled={!temBiometria} trackColor={{ true: cores.primaria }} />
        </Linha>
        <Linha titulo="Bloquear prints da tela" sub="Também esconde o app na tela de recentes">
          <Switch value={config.bloquearCapturas} onValueChange={alternarCapturas} trackColor={{ true: cores.primaria }} />
        </Linha>
        <Botao titulo="Alterar PIN" variante="secundario" icone="keypad-outline" onPress={() => router.push('/configurar-pin')} />
        <View style={s.selos}>
          <Selo icone="lock-closed-outline" texto="Banco do celular criptografado (AES-256)" />
          <Selo icone="shield-checkmark-outline" texto="Conexão segura (HTTPS/TLS) com a nuvem" />
          <Selo icone="person-outline" texto="Cada conta só acessa os próprios dados" />
        </View>
      </Cartao>

      <TituloSecao>Resumo por e-mail</TituloSecao>
      <Cartao style={{ gap: 12 }}>
        <Linha titulo="Resumo semanal" sub="Toda segunda de manhã: contas atrasadas e as que vencem na semana.">
          <Switch
            value={config.emailSemanal}
            disabled={ocupado}
            trackColor={{ true: cores.primaria }}
            onValueChange={(ativo) =>
              executar(async () => {
                setConfig((c) => (c ? { ...c, emailSemanal: ativo } : c));
                await salvarPreferencias(db, { emailSemanal: ativo });
                await sincronizar(db);
              }, 'Não foi possível salvar')
            }
          />
        </Linha>
        <Botao
          titulo="Enviar um resumo agora"
          variante="secundario"
          icone="paper-plane-outline"
          desabilitado={ocupado}
          onPress={() =>
            executar(async () => {
              await sincronizar(db);
              await enviarResumoTeste();
              Alert.alert('E-mail enviado', `Confira a caixa de entrada de ${usuario?.email}.`);
            }, 'Falha ao enviar o e-mail')
          }
        />
      </Cartao>
    </>
  );
}

function Linha({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return (
    <View style={s.linha}>
      <View style={{ flex: 1 }}>
        <Text style={s.titulo}>{titulo}</Text>
        {!!sub && <Text style={s.sub}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
}

function Selo({ icone, texto }: { icone: 'lock-closed-outline' | 'shield-checkmark-outline' | 'person-outline'; texto: string }) {
  return (
    <View style={s.selo}>
      <Ionicons name={icone} size={16} color={cores.primaria} />
      <Text style={s.seloTexto}>{texto}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: { fontSize: 16, fontWeight: '600', color: cores.texto },
  sub: { fontSize: 13, color: cores.textoSuave, marginTop: 2, lineHeight: 18 },
  selos: { gap: 6, paddingTop: 4 },
  selo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seloTexto: { fontSize: 13, color: cores.textoSuave },
  excluir: { fontSize: 14, color: cores.perigo, textAlign: 'center', paddingTop: 4, textDecorationLine: 'underline' },
});
