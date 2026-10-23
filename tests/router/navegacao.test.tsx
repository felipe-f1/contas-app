// Renderiza as rotas REAIS de src/app e verifica para onde o app vai em cada
// estado de login. Sessão e banco são simulados; o resto é o código do app.
import { beforeEach, expect, jest, test } from '@jest/globals';
import { renderRouter, screen } from 'expo-router/testing-library';

jest.setTimeout(30_000);

const estado = { carregando: false, usuario: null as null | { id: string; email: string }, pinDefinido: false, bloqueado: false };

jest.mock('../../src/lib/sessao', () => ({
  SessaoProvider: ({ children }: { children: React.ReactNode }) => children,
  useSessao: () => ({ ...estado, desbloquear: jest.fn(), pinCriado: jest.fn(), sair: jest.fn(), aplicarProtecaoDeTela: jest.fn() }),
}));

jest.mock('../../src/lib/cofre', () => ({
  NOME_BANCO: 'teste.db',
  migrarBancoSemCriptografia: () => Promise.resolve(),
  destrancarBanco: () => Promise.resolve(),
  temPin: () => Promise.resolve(false),
}));

jest.mock('expo-sqlite', () => {
  const db = {
    getAllAsync: () => Promise.resolve([]),
    getFirstAsync: () => Promise.resolve(null),
    runAsync: () => Promise.resolve({ changes: 0 }),
    execAsync: () => Promise.resolve(),
    withTransactionAsync: (f: () => Promise<void>) => f(),
  };
  return { SQLiteProvider: ({ children }: { children: React.ReactNode }) => children, useSQLiteContext: () => db };
});

// Ícones não importam para a navegação (e a fonte não carrega no Jest).
jest.mock('@expo/vector-icons/Ionicons', () => {
  // jest.mock não aceita import: o factory roda antes dos imports do módulo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  const Icone = ({ name }: { name: string }) => <Text>{`[${name}]`}</Text>;
  return { __esModule: true, default: Icone };
});

jest.mock('../../src/lib/sincronizar', () => ({ sincronizar: () => Promise.resolve() }));

beforeEach(() => {
  Object.assign(estado, { carregando: false, usuario: null, pinDefinido: false, bloqueado: false });
});

function abrirApp() {
  return renderRouter('./src/app', { initialUrl: '/' });
}

test('deslogado: abre na tela de entrar (não em "Unmatched Route")', async () => {
  const app = await abrirApp();
  expect(await screen.findByText('Entre para ver suas contas a pagar')).toBeTruthy();
  expect(app.getPathname()).toBe('/entrar');
});

test('logado sem PIN: vai para criar o PIN', async () => {
  estado.usuario = { id: 'u1', email: 'a@x.com' };
  const app = await abrirApp();
  expect(await screen.findByText('Crie um PIN de 6 dígitos')).toBeTruthy();
  expect(app.getPathname()).toBe('/configurar-pin');
});

test('logado com PIN: abre na aba A pagar', async () => {
  estado.usuario = { id: 'u1', email: 'a@x.com' };
  estado.pinDefinido = true;
  const app = await abrirApp();
  expect(await screen.findByText('Falta pagar em', { exact: false })).toBeTruthy();
  expect(app.getPathname()).toBe('/');
});
