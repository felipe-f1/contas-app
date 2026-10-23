# Contas em Dia 💸

App de celular (Android e iOS) para lembrar das contas a vencer e controlar os gastos do mês. Substitui a planilha.

## O que ele faz

- **A pagar**: o que está atrasado, o que vence nos próximos 7 dias e nos próximos 30 dias. Um toque marca a conta como paga.
- **Mês**: total, pago e a pagar, gastos por categoria e todos os lançamentos. Navega entre meses como as abas de uma planilha.
- **Contas fixas**: aluguel, luz, internet, cartão... Entram sozinhas em todo mês. Se o valor varia, você ajusta o valor real no lançamento do mês.
- **Lembretes no celular**: aviso X dias antes (configurável) e no dia do vencimento, no horário que você escolher. Contas do mesmo dia viram uma notificação só.
- **Google Agenda**: cada conta pendente vira um evento com alerta na agenda escolhida. Contas pagas, editadas ou apagadas são removidas da agenda automaticamente.
- **Parcelas e receitas**: compras parceladas (3/10), salário e outras entradas, com o saldo do mês.
- **Gráfico**: receitas x despesas dos últimos 6 meses.
- **Planilha**: exporta tudo em CSV, que abre no Excel ou no Google Planilhas.
- **Conta e banco na nuvem**: login com e-mail e senha; os dados ficam no Postgres (Supabase) e sincronizam nos dois sentidos, funcionando também offline.
- **Segurança**: banco do celular criptografado (AES-256), PIN e biometria, bloqueio automático, proteção contra prints e RLS no servidor. Veja [docs/SEGURANCA.md](docs/SEGURANCA.md).
- **Resumo semanal por e-mail**: toda segunda, as contas atrasadas e as da semana.

## Instalar no celular (Android)

Página pública de download: **https://felipe-f1.github.io/contas-app/** (com política de privacidade e exclusão de conta). Publicação na Play Store: veja [loja/FICHA.md](loja/FICHA.md).

Cada envio para a branch `main` gera um APK novo em **[Releases](../../releases)**. Abra a página no celular, toque em `app-release.apk` e instale. As atualizações são instaladas por cima, sem perder dados.

Configuração inicial (uma vez): em **Settings → Secrets and variables → Actions**, crie o secret `ANDROID_KEYSTORE_PASSWORD` com a senha da chave de assinatura em `android-signing/`.

Para desenvolver com recarga instantânea: `npm install`, depois `npx expo start`, e abra pelo app **Expo Go**.

Banco, login e e-mail: siga **[docs/NUVEM.md](docs/NUVEM.md)**.

## Arquitetura

| Decisão | Por quê |
|---|---|
| Expo + React Native + TypeScript | Um código para Android e iOS, e dá para testar no celular sem loja |
| SQLite local criptografado (SQLCipher) | Funciona offline; a chave fica no Keystore do Android |
| Notificações **locais** (`expo-notifications`) | O celular agenda o alerta sozinho, sem servidor |
| Calendário do aparelho (`expo-calendar/legacy`) | Sincroniza com o Google Agenda pela conta Google do celular, sem login no app |
| Supabase (Postgres + Auth) | Login com senha; sincronização incremental em que o mais recente vence; RLS testado com PGlite no CI |
| APK pelo GitHub Actions | Instalação sem loja e sem conta Expo; a chave fixa permite atualizar sem desinstalar |
| Valores em centavos (inteiros) | `float` gera erro de arredondamento com dinheiro |
| Datas como texto `YYYY-MM-DD` | Vencimento dia 10 é dia 10 em qualquer fuso |

```
src/
  app/                  telas (Expo Router)
    (tabs)/             A pagar, Mês, Contas fixas, Ajustes
    lancamento/[id].tsx formulário de lançamento
    conta/[id].tsx      formulário de conta fixa
  components/           UI reutilizável
  lib/
    db.ts               schema, migrações e consultas
    sincronizar.ts      ciclo: servidor → gerar mês → servidor → lembretes
    sync.ts             envio/recebimento incremental com o Postgres
    regrasSync.ts       conflitos, senha, PIN (puro, testado)
    nuvem.ts            cliente Supabase e login
    cofre.ts            chave do banco, migração para SQLCipher, PIN
    sessao.tsx          estado de login, bloqueio automático
    planejarLembretes.ts regra dos lembretes (pura, testada)
    relatorios.ts       resumo do mês, gráfico e CSV (puro, testado)
    datas.ts, dinheiro.ts
supabase/               migrações SQL (tabelas + RLS) e Edge Function do e-mail
plugins/                config plugin de assinatura do APK
tests/                  testes das regras de negócio
```

**Sincronização idempotente**: sempre que algo muda (e ao abrir o app), `sincronizar()` recria as notificações e reconcilia a agenda com o estado do banco. Não há IDs de evento para ficarem dessincronizados: cada evento leva uma marca nas notas, e o app só mexe nos eventos que ele mesmo criou.

## Comandos

```bash
npm test           # testes das regras (datas, dinheiro, lembretes, sync, segurança)
npm run test:banco # migrações + RLS num Postgres embutido (PGlite)
npm run typecheck  # TypeScript
npm run lint       # ESLint
```

## Próximas ideias

- [ ] Importar CSV da planilha antiga
- [ ] Widget na tela inicial do Android com as contas da semana
- [ ] Anexar foto do comprovante de pagamento
