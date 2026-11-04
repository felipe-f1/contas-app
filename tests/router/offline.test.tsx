// Usa o SessaoProvider REAL com o servidor simulado: sem internet / projeto
// pausado, quem já tem conta no aparelho precisa conseguir abrir o app.
import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

jest.setTimeout(30_000);

const mockServidor = {
  // Resposta de getSession: offline/pausado = sem sessão + erro.
  sessao: { data: { session: null }, error: new Error('Network request failed') } as unknown,
};
const mockConfig: Record<string, unknown> = {};

jest.mock('../../src/lib/nuvem', () => ({
  iniciarNuvem: () => ({
    auth: {
      getSession: () => Promise.resolve(mockServidor.sessao),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
    },
  }),
  nuvem: () => ({}),
  prepararUsuario: () => Promise.resolve(),
  entrar: () => Promise.reject(new Error('Sem conexão com a internet.')),
}));

jest.mock('../../src/lib/cofre', () => ({
  NOME_BANCO: 'teste.db',
  migrarBancoSemCriptografia: () => Promise.resolve(),
  destrancarBanco: () => Promise.resolve(),
  temPin: () => Promise.resolve(true),
  conferirPin: (pin: string) => Promise.resolve(pin === '482915'),
  definirPin: () => Promise.resolve(),
  apagarPin: () => Promise.resolve(),
}));

jest.mock('expo-sqlite', () => {
  const db = {
    getAllAsync: (sql: string) =>
      Promise.resolve(
        sql.includes('FROM config')
          ? Object.entries(mockConfig).map(([chave, valor]) => ({ chave, valor: JSON.stringify(valor) }))
          : [],
      ),
    getFirstAsync: () => Promise.resolve(null),
    runAsync: () => Promise.resolve({ changes: 0 }),
    execAsync: () => Promise.resolve(),
    withTransactionAsync: (f: () => Promise<void>) => f(),
  };
  return { SQLiteProvider: ({ children }: { children: React.ReactNode }) => children, useSQLiteContext: () => db };
});

jest.mock('../../src/lib/sincronizar', () => ({
  configurarNotificacoes: () => Promise.resolve(),
  pedirPermissaoNotificacoes: () => Promise.resolve(true),
  sincronizar: () => Promise.resolve(),
  limparLembretes: () => Promise.resolve(),
}));
jest.mock('../../src/lib/sync', () => ({ enviarTudo: () => Promise.resolve(), pendentesDeEnvio: () => Promise.resolve(0) }));
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: () => Promise.resolve(),
  allowScreenCaptureAsync: () => Promise.resolve(),
}));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: () => Promise.resolve(false),
  isEnrolledAsync: () => Promise.resolve(false),
  authenticateAsync: () => Promise.resolve({ success: false }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  const Icone = ({ name }: { name: string }) => <Text>{`[${name}]`}</Text>;
  return { __esModule: true, default: Icone };
});

beforeEach(() => {
  for (const k of Object.keys(mockConfig)) delete mockConfig[k];
  mockServidor.sessao = { data: { session: null }, error: new Error('Network request failed') };
});

async function digitarPin(pin: string) {
  for (const d of pin) await act(async () => fireEvent.press(screen.getByLabelText(d)));
}

test('servidor fora do ar + conta no aparelho: abre o app (pede PIN), não a tela de login', async () => {
  Object.assign(mockConfig, { usuarioId: 'u1', usuarioEmail: 'felipe@exemplo.com' });
  await renderRouter('./src/app', { initialUrl: '/' });

  expect(await screen.findByText('Contas em Dia bloqueado')).toBeTruthy();
  expect(screen.queryByText('Entre para ver suas contas a pagar')).toBeNull();

  await digitarPin('482915');
  expect(await screen.findByText('Falta pagar em', { exact: false })).toBeTruthy();
  // Erro de rede não é motivo para pedir reconexão.
  expect(screen.queryByText('Sincronização pausada. Toque para entrar de novo.')).toBeNull();
});

test('sessão encerrada pelo servidor: app abre e mostra aviso para entrar de novo', async () => {
  Object.assign(mockConfig, { usuarioId: 'u1', usuarioEmail: 'felipe@exemplo.com' });
  mockServidor.sessao = { data: { session: null }, error: null };
  await renderRouter('./src/app', { initialUrl: '/' });

  await screen.findByText('Contas em Dia bloqueado');
  await digitarPin('482915');
  expect(await screen.findByText('Sincronização pausada. Toque para entrar de novo.')).toBeTruthy();
});

test('sem conta no aparelho: mostra a tela de entrar', async () => {
  await renderRouter('./src/app', { initialUrl: '/' });
  expect(await screen.findByText('Entre para ver suas contas a pagar')).toBeTruthy();
});
