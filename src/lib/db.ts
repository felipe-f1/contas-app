import type { SQLiteDatabase } from 'expo-sqlite';

import { type DataISO, type Mes, hojeISO, mesAtual, mesDe, somarMeses, vencimentoNoMes } from './datas';

export const NOME_BANCO = 'contas.db';

export type ContaFixa = {
  id: number;
  nome: string;
  valor_centavos: number;
  dia_vencimento: number;
  categoria: string;
  ativa: number;
};

export type Lancamento = {
  id: number;
  conta_fixa_id: number | null;
  descricao: string;
  valor_centavos: number;
  categoria: string;
  mes: Mes;
  vencimento: DataISO;
  pago_em: DataISO | null;
};

export type Config = {
  diasAntes: number;
  hora: number;
  agendaAtiva: boolean;
  agendaId: string | null;
};

const CONFIG_PADRAO: Config = { diasAntes: 3, hora: 9, agendaAtiva: false, agendaId: null };

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

  await db.execAsync(`PRAGMA user_version = ${versao}`);
}

// ---------------------------------------------------------------------------
// Escritas passam por uma fila: o SQLite não aceita transações aninhadas na
// mesma conexão, e a sincronização em segundo plano pode escrever ao mesmo
// tempo que uma tela.
// ---------------------------------------------------------------------------
let filaEscrita: Promise<unknown> = Promise.resolve();

function emFila<T>(tarefa: () => Promise<T>): Promise<T> {
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
  return emFila(async () => {
    for (const [chave, valor] of Object.entries(parcial)) {
      await db.runAsync(
        'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
        chave,
        JSON.stringify(valor),
      );
    }
  });
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
    const jaGerado = await db.getFirstAsync('SELECT 1 FROM meses_gerados WHERE mes = ?', mes);
    if (jaGerado) return;

    await db.withTransactionAsync(async () => {
      const contas = await db.getAllAsync<ContaFixa>('SELECT * FROM contas_fixas WHERE ativa = 1');
      for (const c of contas) await inserirLancamentoDaConta(db, c, mes);
      await db.runAsync('INSERT INTO meses_gerados (mes) VALUES (?)', mes);
    });
  });
}

async function inserirLancamentoDaConta(db: SQLiteDatabase, c: ContaFixa, mes: Mes) {
  await db.runAsync(
    `INSERT OR IGNORE INTO lancamentos (conta_fixa_id, descricao, valor_centavos, categoria, mes, vencimento)
     VALUES (?, ?, ?, ?, ?, ?)`,
    c.id, c.nome, c.valor_centavos, c.categoria, mes, vencimentoNoMes(mes, c.dia_vencimento),
  );
}

// ---------------------------------------------------------------------------
// Contas fixas
// ---------------------------------------------------------------------------
export function listarContasFixas(db: SQLiteDatabase) {
  return db.getAllAsync<ContaFixa>('SELECT * FROM contas_fixas ORDER BY ativa DESC, dia_vencimento, nome');
}

export function buscarContaFixa(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<ContaFixa>('SELECT * FROM contas_fixas WHERE id = ?', id);
}

export type DadosContaFixa = Omit<ContaFixa, 'id'>;

/**
 * Salva a conta fixa e propaga para os lançamentos ainda não pagos a partir de
 * hoje. Lançamentos pagos são histórico e nunca são alterados.
 */
export function salvarContaFixa(db: SQLiteDatabase, id: number | null, dados: DadosContaFixa) {
  const hoje = hojeISO();
  return emFila(() => db.withTransactionAsync(async () => {
    let contaId = id;
    if (contaId == null) {
      const r = await db.runAsync(
        'INSERT INTO contas_fixas (nome, valor_centavos, dia_vencimento, categoria, ativa) VALUES (?, ?, ?, ?, ?)',
        dados.nome, dados.valor_centavos, dados.dia_vencimento, dados.categoria, dados.ativa,
      );
      contaId = r.lastInsertRowId;
    } else {
      await db.runAsync(
        'UPDATE contas_fixas SET nome = ?, valor_centavos = ?, dia_vencimento = ?, categoria = ?, ativa = ? WHERE id = ?',
        dados.nome, dados.valor_centavos, dados.dia_vencimento, dados.categoria, dados.ativa, contaId,
      );
    }

    // Remove os lançamentos futuros não pagos e recria com os dados novos.
    await db.runAsync(
      'DELETE FROM lancamentos WHERE conta_fixa_id = ? AND pago_em IS NULL AND mes >= ?',
      contaId, mesDe(hoje),
    );
    if (!dados.ativa) return;
    const meses = await db.getAllAsync<{ mes: Mes }>('SELECT mes FROM meses_gerados WHERE mes >= ?', mesDe(hoje));
    for (const { mes } of meses) await inserirLancamentoDaConta(db, { id: contaId, ...dados }, mes);
  }));
}

export function excluirContaFixa(db: SQLiteDatabase, id: number) {
  return emFila(() => db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM lancamentos WHERE conta_fixa_id = ? AND pago_em IS NULL', id);
    await db.runAsync('DELETE FROM contas_fixas WHERE id = ?', id);
  }));
}

// ---------------------------------------------------------------------------
// Lançamentos
// ---------------------------------------------------------------------------
export function listarLancamentosDoMes(db: SQLiteDatabase, mes: Mes) {
  return db.getAllAsync<Lancamento>('SELECT * FROM lancamentos WHERE mes = ? ORDER BY vencimento, descricao', mes);
}

/** Tudo que não foi pago até `ate` (inclui atrasados). */
export function listarPendentes(db: SQLiteDatabase, ate: DataISO) {
  return db.getAllAsync<Lancamento>(
    'SELECT * FROM lancamentos WHERE pago_em IS NULL AND vencimento <= ? ORDER BY vencimento, descricao',
    ate,
  );
}

export function buscarLancamento(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Lancamento>('SELECT * FROM lancamentos WHERE id = ?', id);
}

export type DadosLancamento = Pick<Lancamento, 'descricao' | 'valor_centavos' | 'categoria' | 'vencimento' | 'pago_em'>;

export function salvarLancamento(db: SQLiteDatabase, id: number | null, d: DadosLancamento) {
  return emFila(() => id == null
    ? db.runAsync(
      'INSERT INTO lancamentos (descricao, valor_centavos, categoria, mes, vencimento, pago_em) VALUES (?, ?, ?, ?, ?, ?)',
      d.descricao, d.valor_centavos, d.categoria, mesDe(d.vencimento), d.vencimento, d.pago_em,
    )
    : db.runAsync(
      'UPDATE lancamentos SET descricao = ?, valor_centavos = ?, categoria = ?, mes = ?, vencimento = ?, pago_em = ? WHERE id = ?',
      d.descricao, d.valor_centavos, d.categoria, mesDe(d.vencimento), d.vencimento, d.pago_em, id,
    ));
}

export function alternarPago(db: SQLiteDatabase, l: Lancamento) {
  return emFila(() => db.runAsync('UPDATE lancamentos SET pago_em = ? WHERE id = ?', l.pago_em ? null : hojeISO(), l.id));
}

export function excluirLancamento(db: SQLiteDatabase, id: number) {
  return emFila(() => db.runAsync('DELETE FROM lancamentos WHERE id = ?', id));
}
