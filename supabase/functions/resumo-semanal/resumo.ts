// Lógica pura do e-mail semanal (sem Deno/Node): roda na Edge Function e nos testes.

export type LancamentoResumo = {
  tipo: 'despesa' | 'receita';
  descricao: string;
  valor_centavos: number;
  vencimento: string; // YYYY-MM-DD
  pago_em: string | null;
  parcela_num?: number | null;
  parcela_total?: number | null;
};

export type Resumo = {
  atrasadas: LancamentoResumo[];
  semana: LancamentoResumo[];
  assunto: string;
  html: string;
  vazio: boolean;
};

export function montarResumo(lancamentos: LancamentoResumo[], hoje: string, dias = 7): Resumo {
  const fim = somarDias(hoje, dias - 1);
  const pendentes = lancamentos
    .filter((l) => l.tipo === 'despesa' && !l.pago_em)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const atrasadas = pendentes.filter((l) => l.vencimento < hoje);
  const semana = pendentes.filter((l) => l.vencimento >= hoje && l.vencimento <= fim);
  const total = (ls: LancamentoResumo[]) => ls.reduce((s, l) => s + l.valor_centavos, 0);

  const partes: string[] = [];
  if (semana.length) partes.push(`${semana.length} a vencer (${brl(total(semana))})`);
  if (atrasadas.length) partes.push(`${atrasadas.length} atrasada${atrasadas.length > 1 ? 's' : ''}`);
  const assunto = partes.length ? `💸 Contas da semana: ${partes.join(', ')}` : '✅ Nenhuma conta para esta semana';

  const tabela = (titulo: string, cor: string, ls: LancamentoResumo[]) =>
    ls.length === 0
      ? ''
      : `<h3 style="color:${cor};margin:24px 0 8px">${titulo} · ${brl(total(ls))}</h3>
<table style="width:100%;border-collapse:collapse">${ls
          .map(
            (l) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #eee">${escapar(l.descricao)}${l.parcela_total ? ` (${l.parcela_num}/${l.parcela_total})` : ''}<br><span style="color:#5E6773;font-size:13px">${prazo(l.vencimento, hoje)}</span></td>
<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;font-weight:bold;white-space:nowrap">${brl(l.valor_centavos)}</td>
</tr>`,
          )
          .join('')}</table>`;

  const corpo = partes.length
    ? tabela('⚠️ Atrasadas', '#C2362B', atrasadas) + tabela('📅 Vencem nos próximos 7 dias', '#0E7C66', semana)
    : '<p>Você não tem contas pendentes para os próximos 7 dias. Boa semana! 🎉</p>';

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:auto;color:#14181F">
<h2 style="margin-bottom:4px">Resumo das suas contas</h2>
<p style="color:#5E6773;margin-top:0">Semana de ${dataBR(hoje)} a ${dataBR(fim)}</p>
${corpo}
<p style="color:#5E6773;font-size:12px;margin-top:32px">Enviado pelo app Contas. Para parar de receber, desative em Ajustes → Resumo por e-mail.</p>
</div>`;

  return { atrasadas, semana, assunto, html, vazio: partes.length === 0 };
}

function prazo(vencimento: string, hoje: string) {
  const d = diasEntre(hoje, vencimento);
  if (d === 0) return 'Vence hoje';
  if (d === 1) return 'Vence amanhã';
  if (d > 1) return `Vence ${dataBR(vencimento)} (em ${d} dias)`;
  return `Venceu ${dataBR(vencimento)} (há ${-d} dia${d < -1 ? 's' : ''})`;
}

function utc(s: string) {
  const [a, m, d] = s.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

function diasEntre(de: string, ate: string) {
  return Math.round((utc(ate) - utc(de)) / 86_400_000);
}

function somarDias(s: string, n: number) {
  return new Date(utc(s) + n * 86_400_000).toISOString().slice(0, 10);
}

function dataBR(s: string) {
  const [, m, d] = s.split('-');
  return `${d}/${m}`;
}

function brl(centavos: number) {
  const reais = Math.floor(centavos / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${reais},${String(centavos % 100).padStart(2, '0')}`;
}

/** Descrições vêm do usuário: nunca entram no HTML sem escapar. */
function escapar(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
