import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';

import { type Snapshot, exportarDados, importarDados, lerConfig, salvarConfig } from './db';
import { hashTexto } from './hash';

// Preenchidas no build (variáveis SUPABASE_URL / SUPABASE_ANON_KEY do GitHub).
// A chave "anon" é pública por definição: a segurança vem das regras RLS do banco.
const URL_SUPABASE = process.env.EXPO_PUBLIC_SUPABASE_URL;
const CHAVE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const nuvemConfigurada = !!(URL_SUPABASE && CHAVE_ANON);

const supabase = nuvemConfigurada
  ? createClient(URL_SUPABASE!, CHAVE_ANON!, {
      auth: { storage: Storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    })
  : null;

// Recomendação do Supabase para apps: só renovar o token com o app aberto.
if (supabase) {
  AppState.addEventListener('change', (estado) => {
    if (estado === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

function cliente() {
  if (!supabase) throw new Error('Nuvem não configurada');
  return supabase;
}

// ---------------------------------------------------------------------------
// Login por código enviado ao e-mail (sem senha)
// ---------------------------------------------------------------------------
export async function enviarCodigo(email: string) {
  const { error } = await cliente().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function confirmarCodigo(email: string, codigo: string) {
  const { error } = await cliente().auth.verifyOtp({ email, token: codigo, type: 'email' });
  if (error) throw error;
}

export async function usuarioAtual(): Promise<{ id: string; email: string } | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email ?? '' } : null;
}

export async function sair(db: SQLiteDatabase) {
  await cliente().auth.signOut();
  await salvarConfig(db, { backupAtivo: false, backupHash: null });
}

// ---------------------------------------------------------------------------
// Backup
// ---------------------------------------------------------------------------
export async function infoBackupNuvem(): Promise<{ atualizadoEm: string; lancamentos: number } | null> {
  const { data, error } = await cliente().from('backups').select('dados, atualizado_em').maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { atualizadoEm: data.atualizado_em, lancamentos: (data.dados as Snapshot).lancamentos.length };
}

/** Envia o backup se algo mudou desde o último envio (ou sempre, com `forcar`). */
export async function enviarBackup(db: SQLiteDatabase, forcar = false) {
  const usuario = await usuarioAtual();
  if (!usuario) return;
  const dados = await exportarDados(db);
  const hash = hashTexto(JSON.stringify(dados));
  const config = await lerConfig(db);
  if (!forcar && hash === config.backupHash) return;

  const agora = new Date().toISOString();
  const { error } = await cliente()
    .from('backups')
    .upsert({ user_id: usuario.id, dados, email_semanal: dados.config.emailSemanal, atualizado_em: agora });
  if (error) throw error;
  await salvarConfig(db, { backupHash: hash, backupEm: agora });
}

export async function restaurarBackup(db: SQLiteDatabase) {
  const { data, error } = await cliente().from('backups').select('dados, atualizado_em').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Nenhum backup encontrado');
  const dados = data.dados as Snapshot;
  await importarDados(db, dados);
  await salvarConfig(db, { backupHash: hashTexto(JSON.stringify(dados)), backupEm: data.atualizado_em });
}

// ---------------------------------------------------------------------------
// Resumo por e-mail (Edge Function "resumo-semanal")
// ---------------------------------------------------------------------------
export async function enviarResumoTeste() {
  const { error } = await cliente().functions.invoke('resumo-semanal', { body: { teste: true } });
  if (error) throw error;
}
