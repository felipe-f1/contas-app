import type { SQLiteDatabase } from 'expo-sqlite';

import { type DataISO, type Mes, hojeISO, mesAtual, mesDe, somarMeses, vencimentoNoMes } from './datas';

export const NOME_BANCO = 'contas.db';

export type Tipo = 'despesa' | 'receita';

export type ContaFixa = {
  id: number;
  tipo: Tipo;
  nome: string;
  valor_centavos: number;
  dia_vencimento: number;
  categoria: string;
  ativa: number;
};

export type Lancamento = {
  id: number;
  conta_fixa_id: number | null;
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

export type Config = {
  diasAntes: number;
  hora: number;
  agendaAtiva: boolean;
  agendaId: string | null;
  emailSemanal: boolean;
  /** Só fica ativo depois que o usuário decide entre restaurar ou manter os dados locais. */
  backupAtivo: boolean;
  backupHash: string | null;
  backupEm: string | null;
};

const CONFIG_PADRAO: Config = {
  diasAntes: 3,
  hora: 9,
  agendaAtiva: false,
  agendaId: null,
  emailSemanal: false,
  backupAtivo: false,
  backupHash: null,
  backupEm: null,
};

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
    `INSERT OR IGNORE INTO lancamentos (conta_fixa_id, tipo, descricao, valor_centavos, categoria, mes, vencimento)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    c.id, c.tipo, c.nome, c.valor_centavos, c.categoria, mes, vencimentoNoMes(mes, c.dia_vencimento),
  );
}

// ---------------------------------------------------------------------------
// Contas fixas
// ---------------------------------------------------------------------------
export function listarContasFixas(db: SQLiteDatabase) {
  return db.getAllAsync<ContaFixa>('SELECT * FROM contas_fixas ORDER BY ativa DESC, tipo DESC, dia_vencimento, nome');
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
        'INSERT INTO contas_fixas (tipo, nome, valor_centavos, dia_vencimento, categoria, ativa) VALUES (?, ?, ?, ?, ?, ?)',
        dados.tipo, dados.nome, dados.valor_centavos, dados.dia_vencimento, dados.categoria, dados.ativa,
      );
      contaId = r.lastInsertRowId;
    } else {
      await db.runAsync(
        'UPDATE contas_fixas SET tipo = ?, nome = ?, valor_centavos = ?, dia_vencimento = ?, categoria = ?, ativa = ? WHERE id = ?',
        dados.tipo, dados.nome, dados.valor_centavos, dados.dia_vencimento, dados.categoria, dados.ativa, contaId,
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

/** Despesas não pagas até `ate` (inclui atrasadas). Receitas não geram lembrete. */
export function listarPendentes(db: SQLiteDatabase, ate: DataISO) {
  return db.getAllAsync<Lancamento>(
    "SELECT * FROM lancamentos WHERE tipo = 'despesa' AND pago_em IS NULL AND vencimento <= ? ORDER BY vencimento, descricao",
    ate,
  );
}

export function buscarLancamento(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Lancamento>('SELECT * FROM lancamentos WHERE id = ?', id);
}

export type DadosLancamento = Pick<Lancamento, 'tipo' | 'descricao' | 'valor_centavos' | 'categoria' | 'vencimento' | 'pago_em'>;

export function salvarLancamento(db: SQLiteDatabase, id: number | null, d: DadosLancamento) {
  return emFila(() => id == null
    ? db.runAsync(
      'INSERT INTO lancamentos (tipo, descricao, valor_centavos, categoria, mes, vencimento, pago_em) VALUES (?, ?, ?, ?, ?, ?, ?)',
      d.tipo, d.descricao, d.valor_centavos, d.categoria, mesDe(d.vencimento), d.vencimento, d.pago_em,
    )
    : db.runAsync(
      'UPDATE lancamentos SET tipo = ?, descricao = ?, valor_centavos = ?, categoria = ?, mes = ?, vencimento = ?, pago_em = ? WHERE id = ?',
      d.tipo, d.descricao, d.valor_centavos, d.categoria, mesDe(d.vencimento), d.vencimento, d.pago_em, id,
    ));
}

/**
 * Compra parcelada: cria uma despesa por mês, no mesmo dia da primeira parcela.
 * `d.valor_centavos` é o valor de cada parcela; `d.pago_em` vale só para a primeira.
 */
export function criarParcelado(db: SQLiteDatabase, d: DadosLancamento, parcelas: number) {
  const grupo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const mesInicial = mesDe(d.vencimento);
  const dia = Number(d.vencimento.slice(8, 10));
  return emFila(() => db.withTransactionAsync(async () => {
    for (let i = 0; i < parcelas; i++) {
      const mes = somarMeses(mesInicial, i);
      await db.runAsync(
        `INSERT INTO lancamentos (tipo, descricao, valor_centavos, categoria, mes, vencimento, pago_em, parcela_grupo, parcela_num, parcela_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        d.tipo, d.descricao, d.valor_centavos, d.categoria, mes, vencimentoNoMes(mes, dia),
        i === 0 ? d.pago_em : null, grupo, i + 1, parcelas,
      );
    }
  }));
}

/** Exclui esta parcela e as seguintes (ex.: compra cancelada ou quitada antes). */
export function excluirParcelasDesde(db: SQLiteDatabase, l: Lancamento) {
  return emFila(() => db.runAsync(
    'DELETE FROM lancamentos WHERE parcela_grupo = ? AND parcela_num >= ?',
    l.parcela_grupo, l.parcela_num,
  ));
}

export function alternarPago(db: SQLiteDatabase, l: Lancamento) {
  return emFila(() => db.runAsync('UPDATE lancamentos SET pago_em = ? WHERE id = ?', l.pago_em ? null : hojeISO(), l.id));
}

export function excluirLancamento(db: SQLiteDatabase, id: number) {
  return emFila(() => db.runAsync('DELETE FROM lancamentos WHERE id = ?', id));
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------
export function totaisPorMes(db: SQLiteDatabase, de: Mes, ate: Mes) {
  return db.getAllAsync<{ mes: Mes; tipo: Tipo; total: number }>(
    'SELECT mes, tipo, SUM(valor_centavos) AS total FROM lancamentos WHERE mes BETWEEN ? AND ? GROUP BY mes, tipo',
    de, ate,
  );
}

export function listarTodosLancamentos(db: SQLiteDatabase) {
  return db.getAllAsync<Lancamento>('SELECT * FROM lancamentos ORDER BY vencimento, id');
}

// ---------------------------------------------------------------------------
// Backup: "foto" completa dos dados, independente do aparelho
// (a agenda escolhida e o estado do backup ficam de fora).
// ---------------------------------------------------------------------------
export type Snapshot = {
  versao: 1;
  contas_fixas: ContaFixa[];
  lancamentos: Lancamento[];
  meses_gerados: Mes[];
  config: Pick<Config, 'diasAntes' | 'hora' | 'emailSemanal'>;
};

const COLUNAS_CONTA: (keyof ContaFixa)[] = ['id', 'tipo', 'nome', 'valor_centavos', 'dia_vencimento', 'categoria', 'ativa'];
const COLUNAS_LANCAMENTO: (keyof Lancamento)[] = [
  'id', 'conta_fixa_id', 'tipo', 'descricao', 'valor_centavos', 'categoria', 'mes', 'vencimento', 'pago_em',
  'parcela_grupo', 'parcela_num', 'parcela_total',
];

export async function exportarDados(db: SQLiteDatabase): Promise<Snapshot> {
  const config = await lerConfig(db);
  return {
    versao: 1,
    contas_fixas: await db.getAllAsync<ContaFixa>(`SELECT ${COLUNAS_CONTA.join(', ')} FROM contas_fixas ORDER BY id`),
    lancamentos: await db.getAllAsync<Lancamento>(`SELECT ${COLUNAS_LANCAMENTO.join(', ')} FROM lancamentos ORDER BY id`),
    meses_gerados: (await db.getAllAsync<{ mes: Mes }>('SELECT mes FROM meses_gerados ORDER BY mes')).map((m) => m.mes),
    config: { diasAntes: config.diasAntes, hora: config.hora, emailSemanal: config.emailSemanal },
  };
}

/** Substitui todos os dados locais pelo backup (numa transação: ou tudo, ou nada). */
export function importarDados(db: SQLiteDatabase, snap: Snapshot) {
  return emFila(() => db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM lancamentos; DELETE FROM contas_fixas; DELETE FROM meses_gerados;');
    for (const c of snap.contas_fixas) {
      await db.runAsync(
        `INSERT INTO contas_fixas (${COLUNAS_CONTA.join(', ')}) VALUES (${COLUNAS_CONTA.map(() => '?').join(', ')})`,
        COLUNAS_CONTA.map((k) => c[k]),
      );
    }
    for (const l of snap.lancamentos) {
      await db.runAsync(
        `INSERT INTO lancamentos (${COLUNAS_LANCAMENTO.join(', ')}) VALUES (${COLUNAS_LANCAMENTO.map(() => '?').join(', ')})`,
        COLUNAS_LANCAMENTO.map((k) => l[k]),
      );
    }
    for (const mes of snap.meses_gerados) await db.runAsync('INSERT INTO meses_gerados (mes) VALUES (?)', mes);
    for (const [chave, valor] of Object.entries(snap.config)) {
      await db.runAsync(
        'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
        chave, JSON.stringify(valor),
      );
    }
  }));
}
