import * as LocalAuthentication from 'expo-local-authentication';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { conferirPin } from '../lib/cofre';
import { lerConfig, salvarConfig } from '../lib/db';
import { MAX_TENTATIVAS_PIN } from '../lib/regrasSync';
import { useSessao } from '../lib/sessao';
import { cores } from '../lib/tema';
import { TecladoPin } from './TecladoPin';

export function TelaBloqueio() {
  const db = useSQLiteContext();
  const { usuario, desbloquear, sair } = useSessao();
  const [pin, setPin] = useState('');
  const [erro, setErro] = useState(false);
  const [restantes, setRestantes] = useState(MAX_TENTATIVAS_PIN);
  const [usaBiometria, setUsaBiometria] = useState(false);

  const tentarBiometria = useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear Contas',
      cancelLabel: 'Usar PIN',
      disableDeviceFallback: true,
    });
    if (r.success) {
      await salvarConfig(db, { tentativasPin: 0 });
      desbloquear();
    }
  }, [db, desbloquear]);

  useEffect(() => {
    (async () => {
      const config = await lerConfig(db);
      setRestantes(MAX_TENTATIVAS_PIN - config.tentativasPin);
      const disponivel = config.biometria && (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setUsaBiometria(disponivel);
      if (disponivel) tentarBiometria();
    })();
  }, [db, tentarBiometria]);

  async function digitar(v: string) {
    setErro(false);
    setPin(v);
    if (v.length < 6) return;

    if (await conferirPin(v)) {
      await salvarConfig(db, { tentativasPin: 0 });
      desbloquear();
      return;
    }
    // O contador fica salvo: fechar e abrir o app não zera as tentativas.
    const tentativas = (await lerConfig(db)).tentativasPin + 1;
    await salvarConfig(db, { tentativasPin: tentativas });
    setErro(true);
    setPin('');
    setRestantes(MAX_TENTATIVAS_PIN - tentativas);
    if (tentativas >= MAX_TENTATIVAS_PIN) {
      await sair({ semEnviar: true }).catch(() => {});
      Alert.alert('Muitas tentativas', 'Por segurança, você saiu da conta. Entre novamente com seu e-mail e senha.');
    }
  }

  function esqueciPin() {
    Alert.alert('Esqueceu o PIN?', 'Você vai sair da conta e entrar de novo com e-mail e senha. Alterações ainda não enviadas serão enviadas antes.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair e entrar de novo',
        style: 'destructive',
        onPress: () =>
          sair().catch(() =>
            Alert.alert('Sem internet', 'Conecte-se para não perder alterações recentes, ou tente o PIN de novo.'),
          ),
      },
    ]);
  }

  return (
    <SafeAreaView style={[StyleSheet.absoluteFill, s.tela]}>
      <View style={s.topo}>
        <Ionicons name="lock-closed" size={36} color={cores.primaria} />
        <Text style={s.titulo}>Contas bloqueado</Text>
        <Text style={s.sub}>{usuario?.email}</Text>
        <Text style={[s.sub, erro && { color: cores.perigo }]}>
          {erro ? `PIN incorreto. ${restantes} tentativa${restantes === 1 ? '' : 's'} restante${restantes === 1 ? '' : 's'}.` : 'Digite seu PIN'}
        </Text>
      </View>
      <TecladoPin valor={pin} onChange={digitar} erro={erro} onBiometria={usaBiometria ? tentarBiometria : undefined} />
      <Text style={s.link} onPress={esqueciPin} accessibilityRole="link">
        Esqueci meu PIN
      </Text>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  tela: { backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'space-evenly', zIndex: 100 },
  topo: { alignItems: 'center', gap: 6 },
  titulo: { fontSize: 22, fontWeight: '800', color: cores.texto, marginTop: 8 },
  sub: { fontSize: 15, color: cores.textoSuave },
  link: { fontSize: 15, color: cores.primaria, fontWeight: '600', padding: 12 },
});
