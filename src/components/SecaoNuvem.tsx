import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { type Config, lerConfig, salvarConfig } from '../lib/db';
import {
  confirmarCodigo,
  enviarBackup,
  enviarCodigo,
  enviarResumoTeste,
  infoBackupNuvem,
  nuvemConfigurada,
  restaurarBackup,
  sair,
  usuarioAtual,
} from '../lib/nuvem';
import { sincronizar } from '../lib/sincronizar';
import { cores } from '../lib/tema';
import { Botao, Cartao, TituloSecao, estilos } from './ui';

type Etapa = 'carregando' | 'deslogado' | 'codigo' | 'logado';

function formatarMomento(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SecaoNuvem() {
  const db = useSQLiteContext();
  const [etapa, setEtapa] = useState<Etapa>('carregando');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);

  const recarregar = useCallback(async () => {
    setConfig(await lerConfig(db));
    const u = await usuarioAtual();
    if (u) setEmail(u.email);
    setEtapa(u ? 'logado' : 'deslogado');
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
    }
  }

  const pedirCodigo = () =>
    executar(async () => {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Digite um e-mail válido.');
      await enviarCodigo(email.trim());
      setEtapa('codigo');
    }, 'Não foi possível enviar o código');

  const entrar = () =>
    executar(async () => {
      await confirmarCodigo(email.trim(), codigo.trim());
      setCodigo('');
      await decidirPrimeiroBackup();
      await recarregar();
    }, 'Código inválido ou expirado');

  /** No primeiro login neste aparelho, nunca sobrescrever nada sem perguntar. */
  async function decidirPrimeiroBackup() {
    const nuvem = await infoBackupNuvem();
    if (!nuvem) {
      await salvarConfig(db, { backupAtivo: true });
      await enviarBackup(db, true);
      return;
    }
    await new Promise<void>((resolve) =>
      Alert.alert(
        'Backup encontrado',
        `Existe um backup de ${formatarMomento(nuvem.atualizadoEm)} com ${nuvem.lancamentos} lançamentos. O que deseja fazer?`,
        [
          {
            text: 'Manter dados deste celular',
            onPress: async () => {
              await salvarConfig(db, { backupAtivo: true });
              await enviarBackup(db, true).catch(() => {});
              resolve();
            },
          },
          {
            text: 'Restaurar backup',
            onPress: async () => {
              await restaurarBackup(db);
              await salvarConfig(db, { backupAtivo: true });
              await sincronizar(db);
              resolve();
            },
          },
        ],
        { cancelable: false },
      ),
    );
  }

  const backupAgora = () =>
    executar(async () => {
      await enviarBackup(db, true);
      await recarregar();
      Alert.alert('Backup concluído ✅');
    }, 'Falha no backup');

  const restaurar = () =>
    Alert.alert('Restaurar backup?', 'Os dados deste celular serão substituídos pelos da nuvem.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Restaurar',
        style: 'destructive',
        onPress: () =>
          executar(async () => {
            await restaurarBackup(db);
            await sincronizar(db);
            await recarregar();
            Alert.alert('Dados restaurados ✅');
          }, 'Falha ao restaurar'),
      },
    ]);

  const alternarEmail = (ativo: boolean) =>
    executar(async () => {
      await salvarConfig(db, { emailSemanal: ativo });
      setConfig((c) => (c ? { ...c, emailSemanal: ativo } : c));
      await enviarBackup(db, true);
    }, 'Não foi possível salvar');

  const testarEmail = () =>
    executar(async () => {
      await enviarBackup(db);
      await enviarResumoTeste();
      Alert.alert('E-mail enviado', `Confira a caixa de entrada de ${email}.`);
    }, 'Falha ao enviar o e-mail');

  if (!nuvemConfigurada) {
    return (
      <>
        <TituloSecao>Backup na nuvem e e-mail</TituloSecao>
        <Cartao style={s.linha}>
          <Ionicons name="cloud-offline-outline" size={22} color={cores.textoSuave} />
          <Text style={[s.sub, { flex: 1 }]}>
            Ainda não configurado. Siga o guia docs/NUVEM.md do projeto (leva uns 10 minutos) e gere um novo APK.
          </Text>
        </Cartao>
      </>
    );
  }

  return (
    <>
      <TituloSecao>Backup na nuvem</TituloSecao>
      <Cartao style={{ gap: 12 }}>
        {etapa === 'carregando' && <ActivityIndicator color={cores.primaria} />}

        {etapa === 'deslogado' && (
          <>
            <Text style={s.sub}>Entre com seu e-mail para guardar seus dados online e não perder nada ao trocar de celular.</Text>
            <TextInput
              style={estilos.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={cores.textoSuave}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Botao titulo="Receber código por e-mail" icone="mail-outline" onPress={pedirCodigo} desabilitado={ocupado} />
          </>
        )}

        {etapa === 'codigo' && (
          <>
            <Text style={s.sub}>Enviamos um código para {email}. Digite-o abaixo:</Text>
            <TextInput
              style={[estilos.input, s.codigo]}
              value={codigo}
              onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 8))}
              placeholder="000000"
              placeholderTextColor={cores.borda}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              autoFocus
            />
            <Botao titulo="Entrar" icone="log-in-outline" onPress={entrar} desabilitado={ocupado || codigo.length < 6} />
            <Botao titulo="Usar outro e-mail" variante="secundario" onPress={() => setEtapa('deslogado')} />
          </>
        )}

        {etapa === 'logado' && config && (
          <>
            <View style={s.linha}>
              <Ionicons name="cloud-done-outline" size={24} color={cores.primaria} />
              <View style={{ flex: 1 }}>
                <Text style={s.titulo}>{email}</Text>
                <Text style={s.sub}>
                  {config.backupEm ? `Último backup: ${formatarMomento(config.backupEm)}` : 'Nenhum backup ainda'} · automático
                </Text>
              </View>
            </View>
            <Botao titulo="Fazer backup agora" variante="secundario" icone="cloud-upload-outline" onPress={backupAgora} desabilitado={ocupado} />
            <Botao titulo="Restaurar backup" variante="secundario" icone="cloud-download-outline" onPress={restaurar} desabilitado={ocupado} />
            <Botao titulo="Sair" variante="perigo" icone="log-out-outline" onPress={() => executar(async () => { await sair(db); await recarregar(); }, 'Falha ao sair')} />
          </>
        )}
      </Cartao>

      <TituloSecao>Resumo por e-mail</TituloSecao>
      <Cartao style={{ gap: 12 }}>
        {etapa === 'logado' && config ? (
          <>
            <View style={s.linha}>
              <View style={{ flex: 1 }}>
                <Text style={s.titulo}>Resumo semanal</Text>
                <Text style={s.sub}>Toda segunda de manhã: contas atrasadas e as que vencem na semana.</Text>
              </View>
              <Switch value={config.emailSemanal} onValueChange={alternarEmail} disabled={ocupado} trackColor={{ true: cores.primaria }} />
            </View>
            <Botao titulo="Enviar um resumo agora" variante="secundario" icone="paper-plane-outline" onPress={testarEmail} desabilitado={ocupado} />
          </>
        ) : (
          <Text style={s.sub}>Entre na nuvem acima para receber o resumo semanal no seu e-mail.</Text>
        )}
      </Cartao>
    </>
  );
}

const s = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulo: { fontSize: 16, fontWeight: '600', color: cores.texto },
  sub: { fontSize: 13, color: cores.textoSuave, marginTop: 2, lineHeight: 18 },
  codigo: { fontSize: 28, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
});
