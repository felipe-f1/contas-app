import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { type DataISO, type Mes, hojeISO, mesAtual, mesDe, somarMeses, vencimentoNoMes } from './datas';

export type Tipo = 'despesa' | 'receita';

// Toda linha sincronizável tem:
//  - id texto global (uuid, ou determinístico para lançamentos gerados)
//  - atualizado_em: momento da última alteração (decide conflitos: o mais novo vence)
//  - excluido: exclusão lógica, para que a exclusão também chegue aos outros aparelhos
//  - sujo: 1 enquanto a alteração não foi enviada ao servidor
type Sincronizavel = { atualizado_em: string; excluido: number; sujo: number };

export type ContaFixa = Sincronizavel & {
  id: string;
  tipo: Tipo;
  nome: string;
  valor_centavos: number;
  dia_vencimento: number;
  categoria: string;
  ativa: number;
};

export type Lancamento = Sincronizavel & {
  id: string;
  conta_fixa_id: string | null;
  tipo: Tipo;
  descricao: string;
  valor_centavos: number;
  categoria: string;
  mes: Mes;
  vencimento: DataISO;
  pago_em: DataISO | null;
  parcela_grupo: string | null;
  parcela_num: number | null;
  parcela_total: number | null;
};

export type MesGerado = Sincronizavel & { id: Mes };

export type Config = {
  // Preferências da conta (sincronizadas)
  diasAntes: number;
  hora: number;
  emailSemanal: boolean;
  prefsAtualizadoEm: string | null;
  prefsSujo: boolean;
  // Do aparelho
  agendaAtiva: boolean;
  agendaId: string | null;
  biometria: boolean;
  bloquearCapturas: boolean;
  usuarioId: string | null;
  ultimaSincronizacao: string | null;
  tentativasPin: number;
};

const CONFIG_PADRAO: Config = {
  diasAntes: 3,
  hora: 9,
  emailSemanal: false,
  prefsAtualizadoEm: null,
  prefsSujo: false,
  agendaAtiva: false,
  agendaId: null,
  biometria: true,
  bloquearCapturas: true,
  usuarioId: null,
  ultimaSincronizacao: null,
  tentativasPin: 0,
};

export const agoraISO = () => new Date().toISOString();

/** Lançamentos gerados por conta fixa têm id previsível: dois aparelhos geram a mesma linha. */
export const idGerado = (contaId: string, mes: Mes) => `${contaId}:${mes}`;

// ---------------------------------------------------------------------------
// Migrações: cada versão nova é um bloco `if (versao < N)`. Nunca edite um bloco
// já publicado; crie o próximo.
// ---------------------------------------------------------------------------
export async function migrar(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  let versao = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;

  if (versao < 1) {
    await db.execAsync(`
      CREATE TABLE contas_fixas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        valor_centavos INTEGER NOT NULL,
        dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
        categoria TEXT NOT NULL,
        ativa INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE lancamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conta_fixa_id INTEGER REFERENCES contas_fixas(id) ON DELETE SET NULL,
        descricao TEXT NOT NULL,
        valor_centavos INTEGER NOT NULL,
        categoria TEXT NOT NULL,
        mes TEXT NOT NULL,
        vencimento TEXT NOT NULL,
        pago_em TEXT,
        UNIQUE (conta_fixa_id, mes)
      );
      CREATE INDEX idx_lancamentos_mes ON lancamentos(mes);
      CREATE INDEX idx_lancamentos_vencimento ON lancamentos(vencimento);
      -- Meses em que as contas fixas já foram geradas. Assim, se você apagar
      -- um lançamento gerado, ele não reaparece na próxima abertura do app.
      CREATE TABLE meses_gerados (mes TEXT PRIMARY KEY);
      CREATE TABLE config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
    `);
    versao = 1;
  }

  if (versao < 2) {
    await db.execAsync(`
      ALTER TABLE contas_fixas ADD COLUMN tipo TEXT NOT NULL DEFAULT 'despesa';
      ALTER TABLE lancamentos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'despesa';
      ALTER TABLE lancamentos ADD COLUMN parcela_grupo TEXT;
      ALTER TABLE lancamentos ADD COLUMN parcela_num INTEGER;
      ALTER TABLE lancamentos ADD COLUMN parcela_total INTEGER;
      CREATE INDEX idx_lancamentos_parcela ON lancamentos(parcela_grupo);
    `);
    versao = 2;
  }

  if (versao < 3) {
    // Sincronização: ids viram texto global e todas as linhas ganham as colunas
    // de controle. O SQLite não troca o tipo da chave primária, então as tabelas
    // são recriadas, preservando os vínculos lançamento → conta fixa.
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        ALTER TABLE contas_fixas ADD COLUMN novo_id TEXT;
        UPDATE contas_fixas SET novo_id = lower(hex(randomblob(16)));

        CREATE TABLE contas_fixas_v3 (
          id TEXT PRIMARY KEY,
          tipo TEXT NOT NULL,
          nome TEXT NOT NULL,
          valor_centavos INTEGER NOT NULL,
          dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
          categoria TEXT NOT NULL,
          ativa INTEGER NOT NULL DEFAULT 1,
          atualizado_em TEXT NOT NULL,
          excluido INTEGER NOT NULL DEFAULT 0,
          sujo INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO contas_fixas_v3 (id, tipo, nome, valor_centavos, dia_vencimento, categoria, ativa, atualizado_em)
          SELECT novo_id, tipo, nome, valor_centavos, dia_vencimento, categoria, ativa, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          FROM contas_fixas;

        CREATE TABLE lancamentos_v3 (
          id TEXT PRIMARY KEY,
          conta_fixa_id TEXT,
          tipo TEXT NOT NULL,
          descricao TEXT NOT NULL,
          valor_centavos INTEGER NOT NULL,
          categoria TEXT NOT NULL,
          mes TEXT NOT NULL,
          vencimento TEXT NOT NULL,
          pago_em TEXT,
          parcela_grupo TEXT,
          parcela_num INTEGER,
          parcela_total INTEGER,
          atualizado_em TEXT NOT NULL,
          excluido INTEGER NOT NULL DEFAULT 0,
          sujo INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO lancamentos_v3 (id, conta_fixa_id, tipo, descricao, valor_centavos, categoria, mes, vencimento, pago_em,
                                    parcela_grupo, parcela_num, parcela_total, atualizado_em)
          SELECT CASE WHEN c.novo_id IS NOT NULL THEN c.novo_id || ':' || l.mes ELSE lower(hex(randomblob(16))) END,
                 c.novo_id, l.tipo, l.descricao, l.valor_centavos, l.categoria, l.mes, l.vencimento, l.pago_em,
                 l.parcela_grupo, l.parcela_num, l.parcela_total, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
          FROM lancamentos l LEFT JOIN contas_fixas c ON c.id = l.conta_fixa_id;

        CREATE TABLE meses_gerados_v3 (
          id TEXT PRIMARY KEY,
          atualizado_em TEXT NOT NULL,
          excluido INTEGER NOT NULL DEFAULT 0,
          sujo INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO meses_gerados_v3 (id, atualizado_em) SELECT mes, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM meses_gerados;

        DROP TABLE lancamentos;
        DROP TABLE contas_fixas;
        DROP TABLE meses_gerados;
        ALTER TABLE contas_fixas_v3 RENAME TO contas_fixas;
        ALTER TABLE lancamentos_v3 RENAME TO lancamentos;
        ALTER TABLE meses_gerados_v3 RENAME TO meses_gerados;

        CREATE INDEX idx_lancamentos_mes ON lancamentos(mes);
        CREATE INDEX idx_lancamentos_vencimento ON lancamentos(vencimento);
        CREATE INDEX idx_lancamentos_parcela ON lancamentos(parcela_grupo);
        CREATE INDEX idx_lancamentos_sujo ON lancamentos(sujo) WHERE sujo = 1;

        -- Sessão do login (tokens), guardada aqui porque este banco é criptografado.
        CREATE TABLE sessao (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);

        -- Chaves do backup antigo (substituído pela sincronização).
        DELETE FROM config WHERE chave IN ('backupAtivo', 'backupHash', 'backupEm');
      `);
    });
    versao = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${versao}`);
}

// ---------------------------------------------------------------------------
// Escritas passam por uma fila: o SQLite não aceita transações aninhadas na
// mesma conexão, e a sincronização em segundo plano pode escrever ao mesmo
// tempo que uma tela. Nunca faça chamadas de rede dentro da fila.
// ---------------------------------------------------------------------------
let filaEscrita: Promise<unknown> = Promise.resolve();

export function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
  const resultado = filaEscrita.then(tarefa);
  filaEscrita = resultado.catch(() => {});
  return resultado;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export async function lerConfig(db: SQLiteDatabase): Promise<Config> {
  const linhas = await db.getAllAsync<{ chave: string; valor: string }>('SELECT chave, valor FROM config');
  const salvo = Object.fromEntries(linhas.map((l) => [l.chave, JSON.parse(l.valor)]));
  return { ...CONFIG_PADRAO, ...salvo };
}

export function salvarConfig(db: SQLiteDatabase, parcial: Partial<Config>) {
  return emFila(() => gravarConfig(db, parcial));
}

async function gravarConfig(db: SQLiteDatabase, parcial: Partial<Config>) {
  for (const [chave, valor] of Object.entries(parcial)) {
    await db.runAsync(
      'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
      chave,
      JSON.stringify(valor),
    );
  }
}

export type Preferencias = Pick<Config, 'diasAntes' | 'hora' | 'emailSemanal'>;

/** Preferências da conta: marcadas para envio, como qualquer outra alteração. */
export function salvarPreferencias(db: SQLiteDatabase, parcial: Partial<Preferencias>) {
  return salvarConfig(db, { ...parcial, prefsAtualizadoEm: agoraISO(), prefsSujo: true });
}

// ---------------------------------------------------------------------------
// Sessão do login (usada como "storage" pelo cliente do Supabase). Fora da fila
// de propósito: a renovação do token pode acontecer durante a sincronização.
// ---------------------------------------------------------------------------
export async function lerSessao(db: SQLiteDatabase, chave: string) {
  return (await db.getFirstAsync<{ valor: string }>('SELECT valor FROM sessao WHERE chave = ?', chave))?.valor ?? null;
}

export async function gravarSessao(db: SQLiteDatabase, chave: string, valor: string) {
  await db.runAsync(
    'INSERT INTO sessao (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
    chave,
    valor,
  );
}

export async function apagarSessao(db: SQLiteDatabase, chave: string) {
  await db.runAsync('DELETE FROM sessao WHERE chave = ?', chave);
}

/** Ao sair da conta (ou entrar com outra), nada do usuário anterior fica no aparelho. */
export function limparDadosDoUsuario(db: SQLiteDatabase) {
  return emFila(() =>
    db.withTransactionAsync(async () => {
      await db.execAsync('DELETE FROM lancamentos; DELETE FROM contas_fixas; DELETE FROM meses_gerados;');
      await db.runAsync(
        `DELETE FROM config WHERE chave IN ('diasAntes', 'hora', 'emailSemanal', 'prefsAtualizadoEm', 'prefsSujo',
          'usuarioId', 'ultimaSincronizacao', 'tentativasPin') OR chave LIKE 'cursor:%'`,
      );
    }),
  );
}

// ---------------------------------------------------------------------------
// Geração mensal das contas fixas
// ---------------------------------------------------------------------------

/** Garante que as contas fixas existam como lançamentos no mês atual e no próximo. */
export async function gerarMesesPendentes(db: SQLiteDatabase, agora = new Date()) {
  const atual = mesAtual(agora);
  for (const mes of [atual, somarMeses(atual, 1)]) await gerarMes(db, mes, agora);
}

/** Gera as contas fixas de um mês (uma única vez). Meses passados não são gerados. */
export function gerarMes(db: SQLiteDatabase, mes: Mes, agora = new Date()) {
  return emFila(async () => {
    if (mes < mesAtual(agora)) return;
    const jaGerado = await db.getFirstAsync('SELECT 1 FROM meses_gerados WHERE id = ?', mes);
    if (jaGerado) return;

    await db.withTransactionAsync(async () => {
      const contas = await db.getAllAsync<ContaFixa>('SELECT * FROM contas_fixas WHERE ativa = 1 AND excluido = 0');
      for (const c of contas) await inserirLancamentoDaConta(db, c, mes);
      await db.runAsync('INSERT OR IGNORE INTO meses_gerados (id, atualizado_em) VALUES (?, ?)', mes, agoraISO());
    });
  });
}

/**
 * Cria (ou atualiza, se ainda não pago) o lançamento da conta no mês. Um
 * lançamento que o usuário excluiu continua excluído.
 */
async function inserirLancamentoDaConta(db: SQLiteDatabase, c: Pick<ContaFixa, 'id' | 'tipo' | 'nome' | 'valor_centavos' | 'categoria' | 'dia_vencimento'>, mes: Mes) {
  await db.runAsync(
    `INSERT INTO lancamentos (id, conta_fixa_id, tipo, descricao, valor_centavos, categoria, mes, vencimento, atualizado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       tipo = excluded.tipo, descricao = excluded.descricao, valor_centavos = excluded.valor_centavos,
       categoria = excluded.categoria, vencimento = excluded.vencimento,
       atualizado_em = excluded.atualizado_em, sujo = 1
     WHERE lancamentos.pago_em IS NULL AND lancamentos.excluido = 0`,
    idGerado(c.id, mes), c.id, c.tipo, c.nome, c.valor_centavos, c.categoria, mes, vencimentoNoMes(mes, c.dia_vencimento), agoraISO(),
  );
}

// ---------------------------------------------------------------------------
// Contas fixas
// ---------------------------------------------------------------------------
export function listarContasFixas(db: SQLiteDatabase) {
  return db.getAllAsync<ContaFixa>(
    'SELECT * FROM contas_fixas WHERE excluido = 0 ORDER BY ativa DESC, tipo DESC, dia_vencimento, nome',
  );
}

export function buscarContaFixa(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<ContaFixa>('SELECT * FROM contas_fixas WHERE id = ? AND excluido = 0', id);
}

export type DadosContaFixa = Pick<ContaFixa, 'tipo' | 'nome' | 'valor_centavos' | 'dia_vencimento' | 'categoria' | 'ativa'>;

/**
 * Salva a conta fixa e propaga para os lançamentos ainda não pagos a partir do
 * mês atual. Lançamentos pagos são histórico e nunca são alterados.
 */
export function salvarContaFixa(db: SQLiteDatabase, id: string | null, d: DadosContaFixa) {
  const contaId = id ?? randomUUID();
  const mesHoje = mesDe(hojeISO());
  return emFila(() =>
    db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO contas_fixas (id, tipo, nome, valor_centavos, dia_vencimento, categoria, ativa, atualizado_em)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           tipo = excluded.tipo, nome = excluded.nome, valor_centavos = excluded.valor_centavos,
           dia_vencimento = excluded.dia_vencimento, categoria = excluded.categoria, ativa = excluded.ativa,
           atualizado_em = excluded.atualizado_em, sujo = 1`,
        contaId, d.tipo, d.nome, d.valor_centavos, d.dia_vencimento, d.categoria, d.ativa, agoraISO(),
      );

      if (!d.ativa) {
        await excluirLancamentosFuturosDaConta(db, contaId, mesHoje);
        return;
      }
      const meses = await db.getAllAsync<{ id: Mes }>('SELECT id FROM meses_gerados WHERE id >= ?', mesHoje);
      for (const { id: mes } of meses) await inserirLancamentoDaConta(db, { id: contaId, ...d }, mes);
    }),
  );
}

async function excluirLancamentosFuturosDaConta(db: SQLiteDatabase, contaId: string, aPartirDe: Mes) {
  await db.runAsync(
    `UPDATE lancamentos SET excluido = 1, atualizado_em = ?, sujo = 1
     WHERE conta_fixa_id = ? AND pago_em IS NULL AND excluido = 0 AND mes >= ?`,
    agoraISO(), contaId, aPartirDe,
  );
}

export function excluirContaFixa(db: SQLiteDatabase, id: string) {
  return emFila(() =>
    db.withTransactionAsync(async () => {
      await excluirLancamentosFuturosDaConta(db, id, '0000-00');
      await db.runAsync('UPDATE contas_fixas SET excluido = 1, atualizado_em = ?, sujo = 1 WHERE id = ?', agoraISO(), id);
    }),
  );
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------
export function listarLancamentosDoMes(db: SQLiteDatabase, mes: Mes) {
  return db.getAllAsync<Lancamento>(
    'SELECT * FROM lancamentos WHERE mes = ? AND excluido = 0 ORDER BY vencimento, descricao',
    mes,
  );
}

/** Despesas não pagas até `ate` (inclui atrasadas). Receitas não geram lembrete. */
export function listarPendentes(db: SQLiteDatabase, ate: DataISO) {
  return db.getAllAsync<Lancamento>(
    `SELECT * FROM lancamentos
     WHERE tipo = 'despesa' AND pago_em IS NULL AND excluido = 0 AND vencimento <= ?
     ORDER BY vencimento, descricao`,
    ate,
  );
}

export function buscarLancamento(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<Lancamento>('SELECT * FROM lancamentos WHERE id = ? AND excluido = 0', id);
}

export type DadosLancamento = Pick<Lancamento, 'tipo' | 'descricao' | 'valor_centavos' | 'categoria' | 'vencimento' | 'pago_em'>;

export function salvarLancamento(db: SQLiteDatabase, id: string | null, d: DadosLancamento) {
  return emFila(() =>
    db.runAsync(
      `INSERT INTO lancamentos (id, tipo, descricao, valor_centavos, categoria, mes, vencimento, pago_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         tipo = excluded.tipo, descricao = excluded.descricao, valor_centavos = excluded.valor_centavos,
         categoria = excluded.categoria, mes = excluded.mes, vencimento = excluded.vencimento,
         pago_em = excluded.pago_em, atualizado_em = excluded.atualizado_em, sujo = 1`,
      id ?? randomUUID(), d.tipo, d.descricao, d.valor_centavos, d.categoria, mesDe(d.vencimento), d.vencimento, d.pago_em, agoraISO(),
    ),
  );
}

/**
 * Compra parcelada: cria uma despesa por mês, no mesmo dia da primeira parcela.
 * `d.valor_centavos` é o valor de cada parcela; `d.pago_em` vale só para a primeira.
 */
export function criarParcelado(db: SQLiteDatabase, d: DadosLancamento, parcelas: number) {
  const grupo = randomUUID();
  const mesInicial = mesDe(d.vencimento);
  const dia = Number(d.vencimento.slice(8, 10));
  return emFila(() =>
    db.withTransactionAsync(async () => {
      for (let i = 0; i < parcelas; i++) {
        const mes = somarMeses(mesInicial, i);
        await db.runAsync(
          `INSERT INTO lancamentos (id, tipo, descricao, valor_centavos, categoria, mes, vencimento, pago_em,
                                    parcela_grupo, parcela_num, parcela_total, atualizado_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          randomUUID(), d.tipo, d.descricao, d.valor_centavos, d.categoria, mes, vencimentoNoMes(mes, dia),
          i === 0 ? d.pago_em : null, grupo, i + 1, parcelas, agoraISO(),
        );
      }
    }),
  );
}

/** Exclui esta parcela e as seguintes (ex.: compra cancelada ou quitada antes). */
export function excluirParcelasDesde(db: SQLiteDatabase, l: Lancamento) {
  return emFila(() =>
    db.runAsync(
      'UPDATE lancamentos SET excluido = 1, atualizado_em = ?, sujo = 1 WHERE parcela_grupo = ? AND parcela_num >= ?',
      agoraISO(), l.parcela_grupo, l.parcela_num,
    ),
  );
}

export function alternarPago(db: SQLiteDatabase, l: Lancamento) {
  return emFila(() =>
    db.runAsync(
      'UPDATE lancamentos SET pago_em = ?, atualizado_em = ?, sujo = 1 WHERE id = ?',
      l.pago_em ? null : hojeISO(), agoraISO(), l.id,
    ),
  );
}

export function excluirLancamento(db: SQLiteDatabase, id: string) {
  return emFila(() =>
    db.runAsync('UPDATE lancamentos SET excluido = 1, atualizado_em = ?, sujo = 1 WHERE id = ?', agoraISO(), id),
  );
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------
export function totaisPorMes(db: SQLiteDatabase, de: Mes, ate: Mes) {
  return db.getAllAsync<{ mes: Mes; tipo: Tipo; total: number }>(
    `SELECT mes, tipo, SUM(valor_centavos) AS total FROM lancamentos
     WHERE excluido = 0 AND mes BETWEEN ? AND ? GROUP BY mes, tipo`,
    de, ate,
  );
}

export function listarTodosLancamentos(db: SQLiteDatabase) {
  return db.getAllAsync<Lancamento>('SELECT * FROM lancamentos WHERE excluido = 0 ORDER BY vencimento, id');
}
