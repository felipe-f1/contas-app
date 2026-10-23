import type { SupabaseClient } from '@supabase/supabase-js';
import type { SQLiteDatabase } from 'expo-sqlite';

import { agoraISO, emFila, lerConfig, salvarConfig } from './db';
import { type NomeTabela, TABELAS, doServidor, inicioDaBusca, paraServidor, remotoVence } from './regrasSync';

const LOTE = 500;

// ---------------------------------------------------------------------------
// Envio: linhas com sujo = 1 vão para o servidor (upsert). O servidor guarda a
// versão mais nova (trigger), então reenviar é sempre seguro.
// ---------------------------------------------------------------------------
async function enviarTabela(db: SQLiteDatabase, supa: SupabaseClient, tabela: NomeTabela) {
  for (;;) {
    const sujas = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${tabela} WHERE sujo = 1 LIMIT ${LOTE}`);
    if (sujas.length === 0) return;

    const { error } = await supa.from(tabela).upsert(sujas.map((l) => paraServidor(tabela, l)), { onConflict: 'user_id,id' });
    if (error) throw error;

    // Só limpa se a linha não mudou enquanto enviávamos.
    await emFila(() =>
      db.withTransactionAsync(async () => {
        for (const l of sujas) {
          await db.runAsync(`UPDATE ${tabela} SET sujo = 0 WHERE id = ? AND atualizado_em = ?`, l.id as string, l.atualizado_em as string);
        }
      }),
    );
    if (sujas.length < LOTE) return;
  }
}

// ---------------------------------------------------------------------------
// Recebimento incremental pelo carimbo do servidor (sincronizado_em).
// ---------------------------------------------------------------------------
async function receberTabela(db: SQLiteDatabase, supa: SupabaseClient, tabela: NomeTabela) {
  const chaveCursor = `cursor:${tabela}`;
  const salvo = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM config WHERE chave = ?', chaveCursor);
  let desde = inicioDaBusca(salvo ? JSON.parse(salvo.valor) : null);
  const { colunas } = TABELAS[tabela];

  for (;;) {
    const { data, error } = await supa
      .from(tabela)
      .select('*')
      .gte('sincronizado_em', desde)
      .order('sincronizado_em')
      .limit(LOTE);
    if (error) throw error;
    if (!data.length) return;

    await emFila(() =>
      db.withTransactionAsync(async () => {
        for (const remoto of data) {
          const linha = doServidor(tabela, remoto);
          const local = await db.getFirstAsync<{ atualizado_em: string; sujo: number }>(
            `SELECT atualizado_em, sujo FROM ${tabela} WHERE id = ?`,
            linha.id as string,
          );
          if (!remotoVence(local, linha as { atualizado_em: string })) continue;
          await db.runAsync(
            `INSERT OR REPLACE INTO ${tabela} (${colunas.join(', ')}, sujo) VALUES (${colunas.map(() => '?').join(', ')}, 0)`,
            colunas.map((c) => linha[c] as string | number | null),
          );
        }
        const ultimo = data[data.length - 1].sincronizado_em as string;
        await db.runAsync(
          'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
          chaveCursor,
          JSON.stringify(ultimo),
        );
        desde = ultimo;
      }),
    );
    if (data.length < LOTE) return;
  }
}

// ---------------------------------------------------------------------------
// Preferências (uma linha por usuário)
// ---------------------------------------------------------------------------
async function receberPreferencias(db: SQLiteDatabase, supa: SupabaseClient) {
  const { data, error } = await supa.from('preferencias').select('*').maybeSingle();
  if (error) throw error;
  if (!data) return;
  const config = await lerConfig(db);
  const local = config.prefsAtualizadoEm ? { atualizado_em: config.prefsAtualizadoEm, sujo: config.prefsSujo ? 1 : 0 } : null;
  if (!remotoVence(local, data)) return;
  await salvarConfig(db, {
    diasAntes: data.dias_antes,
    hora: data.hora,
    emailSemanal: data.email_semanal,
    prefsAtualizadoEm: new Date(data.atualizado_em).toISOString(),
    prefsSujo: false,
  });
}

async function enviarPreferencias(db: SQLiteDatabase, supa: SupabaseClient) {
  const c = await lerConfig(db);
  if (!c.prefsSujo) return;
  const atualizadoEm = c.prefsAtualizadoEm ?? agoraISO();
  const { error } = await supa
    .from('preferencias')
    .upsert({ dias_antes: c.diasAntes, hora: c.hora, email_semanal: c.emailSemanal, atualizado_em: atualizadoEm }, { onConflict: 'user_id' });
  if (error) throw error;
  if ((await lerConfig(db)).prefsAtualizadoEm === atualizadoEm) await salvarConfig(db, { prefsSujo: false });
}

// ---------------------------------------------------------------------------
export async function receberTudo(db: SQLiteDatabase, supa: SupabaseClient) {
  await receberPreferencias(db, supa);
  for (const t of Object.keys(TABELAS) as NomeTabela[]) await receberTabela(db, supa, t);
}

export async function enviarTudo(db: SQLiteDatabase, supa: SupabaseClient) {
  await enviarPreferencias(db, supa);
  // Contas antes dos lançamentos, para o servidor nunca ver um lançamento órfão.
  for (const t of ['contas_fixas', 'meses_gerados', 'lancamentos'] as NomeTabela[]) await enviarTabela(db, supa, t);
  await salvarConfig(db, { ultimaSincronizacao: agoraISO() });
}

export async function pendentesDeEnvio(db: SQLiteDatabase): Promise<number> {
  let total = 0;
  for (const t of Object.keys(TABELAS)) {
    total += (await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM ${t} WHERE sujo = 1`))?.n ?? 0;
  }
  return total + ((await lerConfig(db)).prefsSujo ? 1 : 0);
}
