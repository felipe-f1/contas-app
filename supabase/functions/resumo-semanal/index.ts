// Edge Function: envia o resumo das contas por e-mail (via Resend).
//
// Dois modos:
//  - Agendado (Cron do Supabase), com o header `x-cron-secret`: envia para todos
//    que ativaram o resumo semanal e têm contas na semana.
//  - Pelo app ("Enviar um resumo agora"), com o token do usuário logado: envia só
//    para ele, mesmo que não haja contas.
//
// Secrets necessários: RESEND_API_KEY e CRON_SECRET (opcional: EMAIL_REMETENTE).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

import { type LancamentoResumo, montarResumo } from './resumo.ts';

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const chaveResend = Deno.env.get('RESEND_API_KEY');
  if (!chaveResend) return resposta(500, { erro: 'RESEND_API_KEY não configurada' });

  // Service role: lê dados de vários usuários (só no modo agendado) e o e-mail de cada um.
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const segredoCron = Deno.env.get('CRON_SECRET');
  const ehCron = !!segredoCron && req.headers.get('x-cron-secret') === segredoCron;

  let usuarios: string[];
  if (ehCron) {
    const { data, error } = await admin.from('preferencias').select('user_id').eq('email_semanal', true);
    if (error) return resposta(500, { erro: error.message });
    usuarios = data.map((p) => p.user_id);
  } else {
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return resposta(401, { erro: 'Não autorizado' });
    usuarios = [auth.user.id];
  }

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const remetente = Deno.env.get('EMAIL_REMETENTE') ?? 'Contas em Dia <onboarding@resend.dev>';
  let enviados = 0;
  const falhas: string[] = [];

  for (const userId of usuarios) {
    // Só despesas pendentes até 7 dias à frente (inclui atrasadas).
    const ate = new Date(Date.parse(hoje) + 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: lancamentos, error } = await admin
      .from('lancamentos')
      .select('tipo, descricao, valor_centavos, vencimento, pago_em, parcela_num, parcela_total')
      .eq('user_id', userId)
      .eq('excluido', false)
      .eq('tipo', 'despesa')
      .is('pago_em', null)
      .lte('vencimento', ate);
    if (error) {
      falhas.push(error.message);
      continue;
    }

    const resumo = montarResumo((lancamentos ?? []) as LancamentoResumo[], hoje);
    if (ehCron && resumo.vazio) continue;

    const { data: u } = await admin.auth.admin.getUserById(userId);
    const email = u.user?.email;
    if (!email) continue;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chaveResend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: remetente, to: [email], subject: resumo.assunto, html: resumo.html }),
    });
    if (r.ok) enviados++;
    else falhas.push(`${r.status}: ${await r.text()}`);
  }

  if (!ehCron && falhas.length) return resposta(502, { erro: `Falha no envio (${falhas[0]})` });
  return resposta(200, { enviados, falhas: falhas.length });
});
