# Contas 💸

App de celular (Android e iOS) para lembrar das contas a vencer e controlar os gastos do mês. Substitui a planilha.

## O que ele faz

- **A pagar**: o que está atrasado, o que vence nos próximos 7 dias e nos próximos 30 dias. Um toque marca a conta como paga.
- **Mês**: total, pago e a pagar, gastos por categoria e todos os lançamentos. Navega entre meses como as abas de uma planilha.
- **Contas fixas**: aluguel, luz, internet, cartão... Entram sozinhas em todo mês. Se o valor varia, você ajusta o valor real no lançamento do mês.
- **Lembretes no celular**: aviso X dias antes (configurável) e no dia do vencimento, no horário que você escolher. Contas do mesmo dia viram uma notificação só.
- **Google Agenda**: cada conta pendente vira um evento com alerta na agenda escolhida. Contas pagas, editadas ou apagadas são removidas da agenda automaticamente.

## Como rodar no seu celular

1. Instale o app **Expo Go** no celular (Play Store / App Store).
2. No computador, com [Node.js 22+](https://nodejs.org) instalado:
   ```bash
   npm install
   npx expo start
   ```
3. Escaneie o QR code com a câmera (iPhone) ou com o Expo Go (Android).

> Para instalar como um app de verdade, sem o Expo Go: `npx eas-cli@latest build --profile preview --platform android` gera um APK.

## Arquitetura

| Decisão | Por quê |
|---|---|
| Expo + React Native + TypeScript | Um código para Android e iOS, e dá para testar no celular sem loja |
| SQLite local (`expo-sqlite`) | Funciona offline e os dados ficam no seu aparelho |
| Notificações **locais** (`expo-notifications`) | O celular agenda o alerta sozinho, sem servidor |
| Calendário do aparelho (`expo-calendar/legacy`) | Sincroniza com o Google Agenda pela conta Google do celular, sem login no app |
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
    sincronizar.ts      notificações + Google Agenda
    planejarLembretes.ts regra dos lembretes (pura, testada)
    datas.ts, dinheiro.ts
tests/                  testes das regras de negócio
```

**Sincronização idempotente**: sempre que algo muda (e ao abrir o app), `sincronizar()` recria as notificações e reconcilia a agenda com o estado do banco. Não há IDs de evento para ficarem dessincronizados: cada evento leva uma marca nas notas, e o app só mexe nos eventos que ele mesmo criou.

## Comandos

```bash
npm test           # testes das regras (datas, dinheiro, lembretes)
npm run typecheck  # TypeScript
npm run lint       # ESLint
```

## Próximas fases

- [ ] **E-mail**: resumo semanal no Gmail. Exige um backend pequeno (ex.: Supabase + função agendada).
- [ ] Backup e sincronização na nuvem (trocar de celular sem perder dados)
- [ ] Importar CSV da planilha antiga
- [ ] Parcelamentos (ex.: 3/10) e receitas, para mostrar o saldo do mês
- [ ] Gráfico de evolução dos gastos mês a mês
