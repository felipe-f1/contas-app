// Regras puras da sincronização (sem banco e sem rede), cobertas por testes.

export const TABELAS = {
  contas_fixas: {
    colunas: ['id', 'tipo', 'nome', 'valor_centavos', 'dia_vencimento', 'categoria', 'ativa', 'atualizado_em', 'excluido'],
    booleanos: ['ativa', 'excluido'],
  },
  lancamentos: {
    colunas: [
      'id', 'conta_fixa_id', 'tipo', 'descricao', 'valor_centavos', 'categoria', 'mes', 'vencimento', 'pago_em',
      'parcela_grupo', 'parcela_num', 'parcela_total', 'atualizado_em', 'excluido',
    ],
    booleanos: ['excluido'],
  },
  meses_gerados: {
    colunas: ['id', 'atualizado_em', 'excluido'],
    booleanos: ['excluido'],
  },
} as const;

export type NomeTabela = keyof typeof TABELAS;
type Linha = Record<string, unknown>;

/** Local → servidor: só colunas conhecidas, inteiros 0/1 viram boolean. */
export function paraServidor(tabela: NomeTabela, linha: Linha): Linha {
  const { colunas, booleanos } = TABELAS[tabela];
  const saida: Linha = {};
  for (const c of colunas) saida[c] = (booleanos as readonly string[]).includes(c) ? !!linha[c] : linha[c];
  return saida;
}

/** Servidor → local: descarta user_id/sincronizado_em, normaliza datas e booleanos. */
export function doServidor(tabela: NomeTabela, linha: Linha): Linha {
  const { colunas, booleanos } = TABELAS[tabela];
  const saida: Linha = {};
  for (const c of colunas) {
    const v = linha[c];
    if ((booleanos as readonly string[]).includes(c)) saida[c] = v ? 1 : 0;
    else if (c === 'atualizado_em') saida[c] = new Date(v as string).toISOString();
    else saida[c] = v ?? null;
  }
  return saida;
}

/**
 * Conflito "o mais recente vence": se a linha local não tem alterações
 * pendentes, o servidor é a verdade; se tem, só perde para uma versão mais nova.
 */
export function remotoVence(local: { atualizado_em: string; sujo: number } | null, remoto: { atualizado_em: string }): boolean {
  if (!local || !local.sujo) return true;
  return Date.parse(remoto.atualizado_em) > Date.parse(local.atualizado_em);
}

/**
 * Cursor da busca incremental. Voltamos uma margem no tempo porque uma
 * transação pode gravar no servidor um carimbo um pouco anterior ao seu commit;
 * reaplicar uma linha é inofensivo.
 */
export function inicioDaBusca(cursor: string | null, margemMs = 60_000): string {
  if (!cursor) return '1970-01-01T00:00:00.000Z';
  return new Date(Date.parse(cursor) - margemMs).toISOString();
}

// ---------------------------------------------------------------------------
// Senha
// ---------------------------------------------------------------------------
export function problemaNaSenha(senha: string, email = ''): string | null {
  if (senha.length < 8) return 'Use pelo menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return 'Misture letras e números.';
  const usuario = email.split('@')[0]?.toLowerCase();
  if (usuario && usuario.length >= 4 && senha.toLowerCase().includes(usuario)) return 'Não use seu e-mail na senha.';
  if (/^(.)\1+$/.test(senha) || /^(12345678|password|senha123|abcd1234|qwerty12)/i.test(senha)) return 'Senha muito fácil de adivinhar.';
  return null;
}

// ---------------------------------------------------------------------------
// Bloqueio do app
// ---------------------------------------------------------------------------
export const MAX_TENTATIVAS_PIN = 5;
export const BLOQUEAR_APOS_MS = 60_000;

export function deveBloquear(saiuEm: number | null, agora: number, limiteMs = BLOQUEAR_APOS_MS): boolean {
  return saiuEm != null && agora - saiuEm >= limiteMs;
}

/** PIN de 6 dígitos, sem repetições ou sequências óbvias. */
export function pinValido(pin: string): boolean {
  if (!/^\d{6}$/.test(pin) || /^(\d)\1+$/.test(pin)) return false;
  const sequencia = (passo: number) => [...pin].every((d, i) => i === 0 || Number(d) === (Number(pin[i - 1]) + passo + 10) % 10);
  return !sequencia(1) && !sequencia(-1);
}
