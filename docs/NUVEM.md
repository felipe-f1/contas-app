# Configurar o Supabase (banco de dados e login)

O app usa o projeto `hkvkqtcdvsappbgmkibz`. A URL e a chave pública já vêm embutidas no app. Faça os passos abaixo uma vez, pelo navegador.

> **Nunca compartilhe** a senha do banco nem a chave `service_role` / `sb_secret_...`. Elas dão acesso total aos dados. A chave `sb_publishable_...` é pública por definição.

## 1. Criar as tabelas

No Supabase, abra **SQL Editor → New query**, cole **todo** o conteúdo de [`supabase/migrations/0002_sincronizacao.sql`](../supabase/migrations/0002_sincronizacao.sql) e clique em **Run**. Deve aparecer "Success. No rows returned".

O script cria as tabelas `contas_fixas`, `lancamentos`, `meses_gerados` e `preferencias`, com as regras de segurança (RLS). Pode rodar de novo sem problema.

## 2. Login com e-mail e senha

Em **Authentication → Sign In / Providers → Email**:

- **Enable Email provider**: ligado
- **Confirm email**: ligado (a conta só é criada depois de confirmar o código)
- **Minimum password length**: `8`
- **Password requirements**: "Lowercase, uppercase letters and digits" (ou "Letters and digits")

Em **Authentication → Emails → Templates**, troque o corpo destes três modelos por um texto que mostre o código:

| Modelo | Assunto sugerido |
|---|---|
| **Confirm signup** | Seu código para criar a conta |
| **Reset Password** | Seu código para trocar a senha |
| **Magic Link** | Seu código de acesso |

Corpo, igual para os três:

```html
<h2>Seu código</h2>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Se você não pediu este código, ignore este e-mail.</p>
```

> O envio de e-mail do próprio Supabase tem limite de poucos e-mails por hora. Para uso pessoal basta. Para mais, configure um SMTP (ex.: Resend) em **Authentication → Emails → SMTP Settings**.

## 3. Proteções recomendadas

- **Authentication → Attack Protection**: deixe o limite de tentativas ativo (padrão). Se aparecer a opção "Prevent use of leaked passwords", ative.
- **Authentication → Sessions**: o padrão já está bom. O app renova o token sozinho.

Pronto: instale o APK novo, crie sua conta e defina o PIN.

---

## 4. Resumo semanal por e-mail (opcional)

### 4.1 Chave do Resend

1. Crie uma conta em [resend.com](https://resend.com) **com o mesmo e-mail da sua conta no app**. Sem um domínio próprio, o Resend só envia para esse e-mail.
2. Em **API Keys**, crie uma chave e copie.

### 4.2 Publicar a função

Em **Edge Functions → Deploy a new function → Via Editor**:

1. Nome: `resumo-semanal`.
2. Cole o conteúdo de [`index.ts`](../supabase/functions/resumo-semanal/index.ts) no arquivo principal.
3. Adicione um arquivo `resumo.ts` com o conteúdo de [`resumo.ts`](../supabase/functions/resumo-semanal/resumo.ts).
4. Clique em **Deploy**.

### 4.3 Secrets da função

Em **Edge Functions → Secrets**, adicione:

- `RESEND_API_KEY` = a chave do Resend
- `CRON_SECRET` = um texto aleatório longo, inventado por você

Teste no app: **Ajustes → Resumo por e-mail → Enviar um resumo agora**.

### 4.4 Agendar toda segunda-feira

Em **Integrations → Cron → Create job**:

- **Schedule:** `0 11 * * 1` (segunda às 8h de Brasília)
- **Type:** Supabase Edge Function → `resumo-semanal`, método **POST**
- **Headers:** `x-cron-secret` com o mesmo valor do `CRON_SECRET`

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| "Could not find the table 'public.lancamentos'" | O SQL do passo 1 não foi executado |
| O e-mail chega com link em vez de código | Falta `{{ .Token }}` no modelo (passo 2) |
| "Muitos e-mails enviados" | Limite do e-mail padrão do Supabase: espere 1 hora ou configure SMTP |
| Ajustes mostra "alterações aguardando internet" | Sem conexão ou tabelas ausentes; toque em "Sincronizar agora" para ver o erro |
