// Renderiza as rotas REAIS de src/app e verifica para onde o app vai em cada
// estado de login. Sessão e banco são simulados; o resto é o código do app.
import { beforeEach, expect, jest, test } from '@jest/globals';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

jest.setTimeout(30_000);

const estado = { carregando: false, usuario: null as null | { id: string; email: string }, pinDefinido: false, bloqueado: false };

// Sessão simulada com estado React de verdade: pinCriado() muda o estado e
// re-renderiza a navegação, como o SessaoProvider real.
jest.mock('../../src/lib/sessao', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  const Ctx = React.createContext(null);
  function SessaoProvider({ children }: { children: React.ReactNode }) {
    const [s, setS] = React.useState(() => ({ ...estado }));
    const valor = {
      ...s,
      desbloquear: () => setS((a: typeof estado) => ({ ...a, bloqueado: false })),
      pinCriado: () => setS((a: typeof estado) => ({ ...a, pinDefinido: true })),
      sair: () => Promise.resolve(),
      aplicarProtecaoDeTela: () => Promise.resolve(),
    };
    return React.createElement(Ctx.Provider, { value: valor }, children);
  }
  return { SessaoProvider, useSessao: () => React.useContext(Ctx) };
});

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: () => Promise.resolve(false),
  isEnrolledAsync: () => Promise.resolve(false),
  authenticateAsync: () => Promise.resolve({ success: false }),
}));

jest.mock('../../src/lib/cofre', () => ({
  NOME_BANCO: 'teste.db',
  migrarBancoSemCriptografia: () => Promise.resolve(),
  destrancarBanco: () => Promise.resolve(),
  temPin: () => Promise.resolve(false),
  definirPin: () => Promise.resolve(),
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

test('depois de criar o PIN, o app sai da tela do PIN e abre A pagar', async () => {
  estado.usuario = { id: 'u1', email: 'a@x.com' };
  const app = await abrirApp();
  expect(await screen.findByText('Crie um PIN de 6 dígitos')).toBeTruthy();

  const digitar = async (pin: string) => {
    for (const d of pin) await act(async () => fireEvent.press(screen.getByLabelText(d)));
  };
  await digitar('482915');
  expect(await screen.findByText('Confirme o PIN')).toBeTruthy();
  await digitar('482915');

  expect(await screen.findByText('Falta pagar em', { exact: false })).toBeTruthy();
  expect(app.getPathname()).toBe('/');
});
