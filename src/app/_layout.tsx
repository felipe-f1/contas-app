import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { NOME_BANCO, gerarMesesPendentes, migrar } from '../lib/db';
import { configurarNotificacoes, pedirPermissaoNotificacoes, sincronizar } from '../lib/sincronizar';
import { cores } from '../lib/tema';

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName={NOME_BANCO}
      onInit={async (db) => {
        await migrar(db);
        await gerarMesesPendentes(db);
      }}
    >
      <Sincronizador />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.superficie },
          headerTintColor: cores.primaria,
          headerTitleStyle: { color: cores.texto },
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="lancamento/[id]" options={{ presentation: 'modal', title: 'Lançamento' }} />
        <Stack.Screen name="conta/[id]" options={{ presentation: 'modal', title: 'Conta fixa' }} />
      </Stack>
    </SQLiteProvider>
  );
}

/** Reagenda lembretes ao abrir o app e sempre que ele volta para o primeiro plano. */
function Sincronizador() {
  const db = useSQLiteContext();

  useEffect(() => {
    (async () => {
      await configurarNotificacoes();
      await pedirPermissaoNotificacoes();
      await sincronizar(db);
    })();
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') sincronizar(db);
    });
    return () => sub.remove();
  }, [db]);

  return null;
}
