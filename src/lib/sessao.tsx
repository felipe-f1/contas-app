import * as ScreenCapture from 'expo-screen-capture';
import { useSQLiteContext } from 'expo-sqlite';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { apagarPin, temPin } from './cofre';
import { lerConfig, limparDadosDoUsuario } from './db';
import { iniciarNuvem, prepararUsuario } from './nuvem';
import { deveBloquear } from './regrasSync';
import { configurarNotificacoes, limparLembretes, pedirPermissaoNotificacoes, sincronizar } from './sincronizar';
import { enviarTudo } from './sync';
import { cores } from './tema';

type Usuario = { id: string; email: string };

type Sessao = {
  carregando: boolean;
  usuario: Usuario | null;
  pinDefinido: boolean;
  bloqueado: boolean;
  /** A sessão do servidor caiu (ex.: senha trocada em outro aparelho): o app
   * continua funcionando, mas é preciso entrar de novo para sincronizar. */
  precisaReconectar: boolean;
  desbloquear: () => void;
  pinCriado: () => void;
  /** Envia o que falta e apaga do aparelho tudo que é do usuário. */
  sair: (opcoes?: { semEnviar?: boolean }) => Promise<void>;
  aplicarProtecaoDeTela: (ativa: boolean) => Promise<void>;
};

const Contexto = createContext<Sessao | null>(null);

export function useSessao() {
  const s = useContext(Contexto);
  if (!s) throw new Error('useSessao fora do SessaoProvider');
  return s;
}

export function SessaoProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pinDefinido, setPinDefinido] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [emSegundoPlano, setEmSegundoPlano] = useState(false);
  const [precisaReconectar, setPrecisaReconectar] = useState(false);
  const saiuEm = useRef<number | null>(null);
  const saindo = useRef(false);

  const aplicarProtecaoDeTela = useCallback(async (ativa: boolean) => {
    // FLAG_SECURE no Android: impede prints e esconde o conteúdo na tela de apps recentes.
    if (ativa) await ScreenCapture.preventScreenCaptureAsync('contas');
    else await ScreenCapture.allowScreenCaptureAsync('contas');
  }, []);

  // Entrada no app: depende só do aparelho (conta registrada + PIN), nunca do
  // servidor. Assim o app abre sem internet e com o servidor fora do ar. A
  // sessão do Supabase é usada apenas para sincronizar.
  useEffect(() => {
    const supa = iniciarNuvem(db);
    let ativo = true;

    async function liberar(id: string, email: string) {
      const pin = await temPin();
      if (!ativo) return;
      setPinDefinido(pin);
      setUsuario({ id, email });
      await configurarNotificacoes();
      await pedirPermissaoNotificacoes();
      sincronizar(db);
    }

    async function aoEntrar(id: string, email: string) {
      await prepararUsuario(db, id, email);
      setPrecisaReconectar(false);
      await liberar(id, email);
    }

    (async () => {
      const config = await lerConfig(db);
      if (config.usuarioId) {
        // Abertura a frio: sempre começa bloqueado (pede PIN/digital).
        setBloqueado(await temPin());
        await liberar(config.usuarioId, config.usuarioEmail ?? '');
      }
      await aplicarProtecaoDeTela(config.bloquearCapturas);
      if (ativo) setCarregando(false);

      // Em segundo plano: confere a sessão do servidor, sem bloquear nada.
      const { data, error } = await supa.auth.getSession();
      if (!ativo) return;
      const u = data.session?.user;
      if (u) {
        // Instalações antigas não tinham a conta registrada no aparelho.
        if (!config.usuarioId || !config.usuarioEmail) await aoEntrar(u.id, u.email ?? '');
      } else if (config.usuarioId && !error) {
        // Sem erro e sem sessão: o servidor encerrou a sessão de fato.
        setPrecisaReconectar(true);
      }
      // Com erro (sem internet / servidor fora): segue offline, sem alarde.
    })();

    // O Supabase pede para não chamar a API dentro deste callback; adiamos o trabalho.
    const { data: inscricao } = supa.auth.onAuthStateChange((evento, sessao) => {
      const pedidaPeloUsuario = saindo.current; // lido agora, não dentro do setTimeout
      setTimeout(() => {
        if (evento === 'SIGNED_IN' && sessao?.user) aoEntrar(sessao.user.id, sessao.user.email ?? '');
        // Saída que não foi pedida pelo usuário: mantém o app aberto e pede para reconectar.
        if (evento === 'SIGNED_OUT' && !pedidaPeloUsuario) setPrecisaReconectar(true);
      }, 0);
    });
    return () => {
      ativo = false;
      inscricao.subscription.unsubscribe();
    };
  }, [db, aplicarProtecaoDeTela]);

  // Bloqueio automático depois de um tempo em segundo plano.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      setEmSegundoPlano(estado !== 'active');
      if (estado === 'background') saiuEm.current = Date.now();
      if (estado === 'active') {
        if (usuario && pinDefinido && deveBloquear(saiuEm.current, Date.now())) setBloqueado(true);
        saiuEm.current = null;
        if (usuario) sincronizar(db);
      }
    });
    return () => sub.remove();
  }, [db, usuario, pinDefinido]);

  const sair = useCallback(
    async ({ semEnviar = false } = {}) => {
      const supa = iniciarNuvem(db);
      if (!semEnviar) await enviarTudo(db, supa); // falha (sem internet) → quem chamou decide
      saindo.current = true;
      try {
        await limparLembretes(db);
        await supa.auth.signOut().catch(() => {});
        await limparDadosDoUsuario(db);
        await apagarPin();
        setPinDefinido(false);
        setBloqueado(false);
        setPrecisaReconectar(false);
        setUsuario(null);
      } finally {
        saindo.current = false;
      }
    },
    [db],
  );

  const valor: Sessao = {
    carregando,
    usuario,
    pinDefinido,
    bloqueado,
    precisaReconectar,
    desbloquear: () => setBloqueado(false),
    pinCriado: () => setPinDefinido(true),
    sair,
    aplicarProtecaoDeTela,
  };

  return (
    <Contexto.Provider value={valor}>
      {children}
      {/* No iOS a tela de apps recentes é uma foto do app: cobrimos o conteúdo. */}
      {emSegundoPlano && usuario && (
        <View style={[StyleSheet.absoluteFill, s.cobertura]}>
          <Ionicons name="lock-closed" size={48} color="#fff" />
        </View>
      )}
    </Contexto.Provider>
  );
}

const s = StyleSheet.create({
  cobertura: { backgroundColor: cores.primaria, alignItems: 'center', justifyContent: 'center' },
});
