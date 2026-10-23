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

type Backup = { user_id: string; dados: { lancamentos: LancamentoResumo[] } };

const resposta = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const chaveResend = Deno.env.get('RESEND_API_KEY');
  if (!chaveResend) return resposta(500, { erro: 'RESEND_API_KEY não configurada' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const segredoCron = Deno.env.get('CRON_SECRET');
  const ehCron = !!segredoCron && req.headers.get('x-cron-secret') === segredoCron;

  let backups: Backup[];
  if (ehCron) {
    const { data, error } = await admin.from('backups').select('user_id, dados').eq('email_semanal', true);
    if (error) return resposta(500, { erro: error.message });
    backups = data as Backup[];
  } else {
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
    const { data: auth } = await admin.auth.getUser(token);
    if (!auth.user) return resposta(401, { erro: 'Não autorizado' });
    const { data, error } = await admin.from('backups').select('user_id, dados').eq('user_id', auth.user.id).maybeSingle();
    if (error) return resposta(500, { erro: error.message });
    if (!data) return resposta(404, { erro: 'Faça um backup antes de pedir o resumo' });
    backups = [data as Backup];
  }

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const remetente = Deno.env.get('EMAIL_REMETENTE') ?? 'Contas <onboarding@resend.dev>';
  let enviados = 0;
  const falhas: string[] = [];

  for (const b of backups) {
    const resumo = montarResumo(b.dados.lancamentos ?? [], hoje);
    if (ehCron && resumo.vazio) continue;

    const { data: u } = await admin.auth.admin.getUserById(b.user_id);
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

  if (!ehCron && falhas.length) return resposta(502, { erro: `Resend recusou o envio (${falhas[0]})` });
  return resposta(200, { enviados, falhas: falhas.length });
});
