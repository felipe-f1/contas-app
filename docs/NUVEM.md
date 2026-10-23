# Configurar backup na nuvem e resumo por e-mail

Leva uns 15 minutos, tudo pelo navegador e de graça. Você só faz isso uma vez.

## 1. Criar o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) e clique em **New project**.
2. Dê um nome (ex.: `contas`), crie uma senha do banco (guarde-a) e escolha a região **South America (São Paulo)**.

## 2. Criar a tabela de backup

1. No menu lateral, abra o **SQL Editor**.
2. Cole todo o conteúdo de [`supabase/migrations/0001_backups.sql`](../supabase/migrations/0001_backups.sql) e clique em **Run**.

## 3. Login por código no e-mail

Em **Authentication → Emails → Templates**, edite os modelos **Magic Link** e **Confirm signup**. Em cada um, coloque no corpo:

```html
<h2>Seu código de acesso</h2>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
```

> O e-mail padrão do Supabase tem limite de poucos envios por hora. Para uso pessoal é suficiente.

## 4. Ligar o app ao Supabase

1. No Supabase, abra **Project Settings → API** e copie a **Project URL** e a chave **anon public**.
2. No GitHub, abra o repositório e vá em **Settings → Secrets and variables → Actions → aba Variables → New repository variable**. Crie duas variáveis:
   - `SUPABASE_URL` = a Project URL
   - `SUPABASE_ANON_KEY` = a chave anon public

   A chave anon é pública por definição. Quem protege os dados são as regras RLS do passo 2.
3. Gere um APK novo em **Actions → APK Android → Run workflow** e instale por cima do atual. Seus dados continuam no celular.

Pronto: o backup já funciona. Em **Ajustes → Backup na nuvem**, entre com seu e-mail.

---

## 5. Resumo semanal por e-mail (opcional)

### 5.1 Chave do Resend

1. Crie uma conta em [resend.com](https://resend.com) **usando o mesmo e-mail com que você entra no app**. Sem um domínio próprio, o Resend só envia para o e-mail da conta, o que basta para uso pessoal.
2. Em **API Keys**, crie uma chave e copie.

### 5.2 Publicar a função

No Supabase, abra **Edge Functions → Deploy a new function → Via Editor**:

1. Nome: `resumo-semanal`.
2. Cole o conteúdo de [`index.ts`](../supabase/functions/resumo-semanal/index.ts) no arquivo principal.
3. Adicione um arquivo chamado `resumo.ts` com o conteúdo de [`resumo.ts`](../supabase/functions/resumo-semanal/resumo.ts).
4. Clique em **Deploy**.

> Se preferir usar o terminal: `npx supabase login`, depois `npx supabase link` e `npx supabase functions deploy resumo-semanal`.

### 5.3 Secrets da função

Em **Edge Functions → Secrets**, adicione:

- `RESEND_API_KEY` = a chave do Resend
- `CRON_SECRET` = um texto aleatório longo, inventado por você (ex.: gerado num gerador de senhas)

Teste no app: **Ajustes → Resumo por e-mail → Enviar um resumo agora**.

### 5.4 Agendar toda segunda-feira

Em **Integrations → Cron**, ative a integração e clique em **Create job**:

- **Name:** `resumo-semanal`
- **Schedule:** `0 11 * * 1` (segunda às 11h UTC, que são 8h em Brasília)
- **Type:** Supabase Edge Function → `resumo-semanal`, método **POST**
- **Headers:** adicione `x-cron-secret` com o mesmo valor do `CRON_SECRET`

No app, ative **Resumo semanal** em Ajustes. Só recebe e-mail quem ativou e tem contas atrasadas ou vencendo na semana.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| App diz "Ainda não configurado" | As variáveis do passo 4 não existiam quando o APK foi gerado. Rode o workflow de novo |
| O e-mail chega com link em vez de código | Falta `{{ .Token }}` nos templates do passo 3 |
| "Resend recusou o envio (403)" | O e-mail do app é diferente do e-mail da conta no Resend |
| Resumo de teste diz "Faça um backup antes" | Toque em "Fazer backup agora" e tente de novo |
