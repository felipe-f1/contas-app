import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TecladoPin } from '../components/TecladoPin';
import { definirPin } from '../lib/cofre';
import { salvarConfig } from '../lib/db';
import { pinValido } from '../lib/regrasSync';
import { useSessao } from '../lib/sessao';
import { cores } from '../lib/tema';

export default function ConfigurarPin() {
  const db = useSQLiteContext();
  const { pinDefinido, pinCriado } = useSessao();
  const [primeiro, setPrimeiro] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function digitar(v: string) {
    setMensagem(null);
    setPin(v);
    if (v.length < 6) return;

    if (primeiro == null) {
      if (!pinValido(v)) {
        setMensagem('PIN muito fácil (repetido ou sequência). Escolha outro.');
        setPin('');
        return;
      }
      setPrimeiro(v);
      setPin('');
      return;
    }
    if (v !== primeiro) {
      setMensagem('Os PINs não conferem. Comece de novo.');
      setPrimeiro(null);
      setPin('');
      return;
    }

    await definirPin(v);
    await salvarConfig(db, { tentativasPin: 0 });
    const temBiometria = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
    await salvarConfig(db, { biometria: temBiometria });
    const eraAlteracao = pinDefinido;
    pinCriado();
    if (eraAlteracao) router.back();
  }

  return (
    <View style={s.tela}>
      <View style={s.topo}>
        <Text style={s.titulo}>{primeiro == null ? (pinDefinido ? 'Novo PIN' : 'Crie um PIN de 6 dígitos') : 'Confirme o PIN'}</Text>
        <Text style={s.sub}>
          {primeiro == null
            ? 'Ele protege o app sempre que você abrir ou voltar depois de 1 minuto. A digital também poderá ser usada.'
            : 'Digite o mesmo PIN mais uma vez.'}
        </Text>
        {!!mensagem && <Text style={s.erro}>{mensagem}</Text>}
      </View>
      <TecladoPin valor={pin} onChange={digitar} erro={!!mensagem} />
    </View>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo, alignItems: 'center', justifyContent: 'space-evenly', padding: 24 },
  topo: { alignItems: 'center', gap: 8 },
  titulo: { fontSize: 22, fontWeight: '800', color: cores.texto, textAlign: 'center' },
  sub: { fontSize: 15, color: cores.textoSuave, textAlign: 'center', lineHeight: 21 },
  erro: { fontSize: 14, color: cores.perigo, textAlign: 'center' },
});
