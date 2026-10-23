import 'react-native-url-polyfill/auto';

import { type SupabaseClient, createClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';

import { apagarSessao, gravarSessao, lerConfig, lerSessao, limparDadosDoUsuario, salvarConfig } from './db';

// A URL e a chave "publishable" são públicas por definição (vão dentro do app);
// quem protege os dados são as regras RLS do banco. O build pode sobrescrever.
const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://hkvkqtcdvsappbgmkibz.supabase.co';
const CHAVE_PUBLICA = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_3le6rz3X9llhq56RQHZnaw_mN893DFS';

let cliente: SupabaseClient | null = null;

/** Cria o cliente usando o banco criptografado como armazenamento da sessão. */
export function iniciarNuvem(db: SQLiteDatabase): SupabaseClient {
  if (cliente) return cliente;
  cliente = createClient(URL_SUPABASE, CHAVE_PUBLICA, {
    auth: {
      storage: {
        getItem: (k) => lerSessao(db, k),
        setItem: (k, v) => gravarSessao(db, k, v),
        removeItem: (k) => apagarSessao(db, k),
      },
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  // Recomendação do Supabase para apps: só renovar o token com o app aberto.
  const c = cliente;
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') c.auth.startAutoRefresh();
    else c.auth.stopAutoRefresh();
  });
  return cliente;
}

export function nuvem(): SupabaseClient {
  if (!cliente) throw new Error('Nuvem não iniciada');
  return cliente;
}

// ---------------------------------------------------------------------------
// Conta: e-mail e senha
// ---------------------------------------------------------------------------
export async function entrar(email: string, senha: string) {
  const { error } = await nuvem().auth.signInWithPassword({ email, password: senha });
  if (error) throw traduzir(error);
}

/** Retorna true se o Supabase exige confirmar o e-mail com o código enviado. */
export async function cadastrar(email: string, senha: string): Promise<boolean> {
  const { data, error } = await nuvem().auth.signUp({ email, password: senha });
  if (error) throw traduzir(error);
  // E-mail já cadastrado: o Supabase responde sem erro e sem identidades (para não vazar quem tem conta).
  if (data.user && data.user.identities?.length === 0) throw new Error('Este e-mail já tem conta. Use "Entrar" ou "Esqueci minha senha".');
  return !data.session;
}

export async function confirmarCadastro(email: string, codigo: string) {
  const { error } = await nuvem().auth.verifyOtp({ email, token: codigo, type: 'signup' });
  if (error) throw traduzir(error);
}

export async function reenviarCodigoCadastro(email: string) {
  const { error } = await nuvem().auth.resend({ type: 'signup', email });
  if (error) throw traduzir(error);
}

export async function pedirCodigoRecuperacao(email: string) {
  const { error } = await nuvem().auth.resetPasswordForEmail(email);
  if (error) throw traduzir(error);
}

export async function redefinirSenha(email: string, codigo: string, novaSenha: string) {
  const { error } = await nuvem().auth.verifyOtp({ email, token: codigo, type: 'recovery' });
  if (error) throw traduzir(error);
  const { error: e2 } = await nuvem().auth.updateUser({ password: novaSenha });
  if (e2) throw traduzir(e2);
}

/** Troca de senha exige a senha atual (protege contra alguém com o celular desbloqueado). */
export async function trocarSenha(email: string, atual: string, nova: string) {
  await entrar(email, atual);
  const { error } = await nuvem().auth.updateUser({ password: nova });
  if (error) throw traduzir(error);
}

/** Se outra conta entrar neste aparelho, os dados da anterior são apagados antes. */
export async function prepararUsuario(db: SQLiteDatabase, usuarioId: string) {
  const { usuarioId: anterior } = await lerConfig(db);
  if (anterior === usuarioId) return;
  if (anterior) await limparDadosDoUsuario(db);
  // Dados criados antes de existir login (v1.0.x) ficam e vão para a conta nova.
  await salvarConfig(db, { usuarioId });
}

export async function enviarResumoTeste() {
  const { error } = await nuvem().functions.invoke('resumo-semanal', { body: { teste: true } });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
function traduzir(e: { message: string; code?: string; status?: number }): Error {
  const porCodigo: Record<string, string> = {
    invalid_credentials: 'E-mail ou senha incorretos.',
    email_not_confirmed: 'Confirme seu e-mail com o código que enviamos antes de entrar.',
    user_already_exists: 'Este e-mail já tem conta. Use "Entrar".',
    weak_password: 'Senha fraca. Use pelo menos 8 caracteres, com letras e números.',
    otp_expired: 'Código inválido ou expirado. Peça um novo.',
    over_email_send_rate_limit: 'Muitos e-mails enviados. Aguarde alguns minutos e tente de novo.',
    over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos.',
    same_password: 'A nova senha precisa ser diferente da atual.',
    signup_disabled: 'Cadastro desativado no servidor.',
  };
  if (e.code && porCodigo[e.code]) return new Error(porCodigo[e.code]);
  if (/sending .*email|smtp/i.test(e.message)) {
    return new Error('O servidor não conseguiu enviar o e-mail. Verifique a configuração de SMTP no Supabase (Authentication → Emails → SMTP).');
  }
  if (/network|fetch/i.test(e.message)) return new Error('Sem conexão com a internet.');
  return new Error(e.message);
}
