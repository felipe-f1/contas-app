import { Stack } from 'expo-router';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { TelaBloqueio } from '../components/TelaBloqueio';
import { NOME_BANCO, destrancarBanco, migrarBancoSemCriptografia } from '../lib/cofre';
import { gerarMesesPendentes, migrar } from '../lib/db';
import { SessaoProvider, useSessao } from '../lib/sessao';
import { cores } from '../lib/tema';

// Fora do componente: o SQLiteProvider reabre o banco se esta função mudar.
async function abrirBanco(db: SQLiteDatabase) {
  await destrancarBanco(db); // precisa ser o primeiro comando (SQLCipher)
  await migrar(db);
  await gerarMesesPendentes(db);
}

export default function RootLayout() {
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    migrarBancoSemCriptografia()
      .then(() => setPronto(true))
      .catch((e) => setErro(String(e)));
  }, []);

  if (erro) return <TelaErro mensagem={erro} />;
  if (!pronto) return <Carregando />;

  return (
    <SQLiteProvider databaseName={NOME_BANCO} onInit={abrirBanco} onError={(e) => setErro(String(e))}>
      <SessaoProvider>
        <StatusBar style="dark" />
        <Navegacao />
      </SessaoProvider>
    </SQLiteProvider>
  );
}

function Navegacao() {
  const { carregando, usuario, pinDefinido, bloqueado } = useSessao();
  if (carregando) return <Carregando />;

  const logado = !!usuario;
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.superficie },
          headerTintColor: cores.primaria,
          headerTitleStyle: { color: cores.texto },
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        {/* App: só com conta e PIN criado */}
        <Stack.Protected guard={logado && pinDefinido}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="lancamento/[id]" options={{ presentation: 'modal', title: 'Lançamento' }} />
          <Stack.Screen name="conta/[id]" options={{ presentation: 'modal', title: 'Conta fixa' }} />
          <Stack.Screen name="trocar-senha" options={{ presentation: 'modal', title: 'Trocar senha' }} />
        </Stack.Protected>

        {/* Sem conta: entrar, cadastrar, recuperar senha. Ficam na raiz (sem grupo):
            um grupo sem index deixa a rota "/" sem destino ("Unmatched Route"). */}
        <Stack.Protected guard={!logado}>
          <Stack.Screen name="entrar" options={{ headerShown: false }} />
          <Stack.Screen name="cadastrar" options={{ headerShown: false }} />
          <Stack.Screen name="recuperar" options={{ headerShown: false }} />
        </Stack.Protected>

        {/* Com conta: criar/alterar PIN. Logado sem PIN, é a ÚNICA tela liberada,
            para o redirecionamento cair sempre nela. */}
        <Stack.Protected guard={logado}>
          <Stack.Screen name="configurar-pin" options={{ title: 'PIN de acesso', headerBackVisible: pinDefinido }} />
        </Stack.Protected>
      </Stack>
      {logado && pinDefinido && bloqueado && <TelaBloqueio />}
    </>
  );
}

function Carregando() {
  return (
    <View style={s.centro}>
      <ActivityIndicator size="large" color={cores.primaria} />
    </View>
  );
}

function TelaErro({ mensagem }: { mensagem: string }) {
  return (
    <View style={[s.centro, { padding: 24, gap: 12 }]}>
      <Text style={{ fontSize: 18, fontWeight: '700', color: cores.texto }}>Não foi possível abrir seus dados</Text>
      <Text style={{ color: cores.textoSuave, textAlign: 'center' }}>{mensagem}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo },
});
