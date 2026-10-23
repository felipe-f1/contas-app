# Ficha da Google Play — Contas em Dia

Tudo que a Play Console pede, pronto para copiar e colar. Artes nesta pasta: `icone-512.png` e `banner-1024x500.png`.

## Detalhes do app

| Campo | Valor |
|---|---|
| Nome do app (até 30) | `Contas em Dia` |
| Idioma padrão | Português (Brasil) – pt-BR |
| App ou jogo | App |
| Gratuito ou pago | Gratuito |
| Categoria | Finanças |
| Política de privacidade | `https://felipe-f1.github.io/contas-app/privacidade.html` |
| E-mail de contato | *(obrigatório e público: use um e-mail de suporte seu)* |

### Descrição curta (até 80 caracteres)

```
Lembretes de contas a vencer e controle dos gastos do mês, com segurança.
```

### Descrição completa (até 4000 caracteres)

```
Nunca mais pague juros por esquecer uma conta.

O Contas em Dia avisa antes de cada vencimento e organiza os gastos do mês num só lugar, substituindo a planilha.

🔔 LEMBRETES QUE FUNCIONAM
• Aviso dias antes e no dia do vencimento, no horário que você escolher
• Contas do mesmo dia num único aviso
• Integração opcional com o Google Agenda

📅 CONTAS FIXAS AUTOMÁTICAS
• Aluguel, luz, internet, cartão, escola: cadastre uma vez e elas entram sozinhas todo mês
• Valor variável? Ajuste só o mês atual

📊 CONTROLE DO MÊS
• Total, pago e a pagar, receitas, despesas e saldo
• Gastos por categoria e gráfico dos últimos 6 meses
• Compras parceladas (3/10) e receitas como salário
• Exportação para planilha (Excel e Google Planilhas)

☁️ NA NUVEM E OFFLINE
• Funciona sem internet e sincroniza quando a conexão volta
• Troque de celular sem perder nada

🔒 SEGURANÇA
• Dados criptografados no celular (AES-256)
• PIN e desbloqueio por digital
• Bloqueio automático e proteção contra capturas de tela
• Cada conta só acessa os próprios dados
• Sem anúncios. Seus dados não são vendidos nem compartilhados.

Grátis. Exclua sua conta e todos os dados a qualquer momento, pelo app ou pela web.
```

## Artes

| Item | Arquivo / instrução |
|---|---|
| Ícone 512×512 | `loja/icone-512.png` |
| Gráfico de recursos 1024×500 | `loja/banner-1024x500.png` |
| Capturas de tela (2 a 8, celular) | Tire no app: desative antes Ajustes → Segurança → **Bloquear prints da tela**. Sugestão: A pagar, Mês com gráfico, Contas fixas, Novo lançamento parcelado, Ajustes (segurança). Use dados de exemplo, nunca seus dados reais |

## Conteúdo do app (seção "Política do app")

| Pergunta | Resposta |
|---|---|
| Política de privacidade | URL acima |
| Anúncios | **Não**, o app não contém anúncios |
| Acesso ao app | **Algumas funcionalidades são restritas**: crie uma conta de teste no app (ex.: `revisor.contasemdia@...`) com senha e PIN, e informe e-mail, senha e o PIN aqui. Sem isso o Google rejeita |
| Classificação do conteúdo | Questionário: categoria "Utilitário/Produtividade", responda **Não** a violência, sexo, drogas, jogos de azar, interação entre usuários e compartilhamento de localização → classificação **Livre** |
| Público-alvo | **18 anos ou mais** (evita as regras do programa para famílias) |
| App de notícias | Não |
| Apps governamentais | Não |
| Recursos financeiros | Declare como app de **gerenciamento de finanças pessoais/orçamento**, sem empréstimos, pagamentos, investimentos ou criptomoedas. Se a lista não tiver essa opção, marque que o app não oferece serviços financeiros |
| Saúde | Não |
| Exclusão de conta | **Sim**, permite criar conta. URL de exclusão: `https://felipe-f1.github.io/contas-app/excluir-conta.html` |

## Segurança dos dados

**Coleta ou compartilha dados?** Sim, coleta. **Compartilha com terceiros?** Não (provedores que só processam para você não contam como compartilhamento).

**Os dados são criptografados em trânsito?** Sim. **O usuário pode pedir exclusão?** Sim.

| Tipo de dado | Coletado | Obrigatório | Finalidade |
|---|---|---|---|
| Informações pessoais → **Endereço de e-mail** | Sim | Obrigatório | Funcionalidade do app, Gerenciamento da conta |
| Informações financeiras → **Outras informações financeiras** (contas, valores, vencimentos) | Sim | Obrigatório | Funcionalidade do app |
| Calendário → **Eventos da agenda** | Não *(o app escreve eventos no aparelho, mas não envia ao servidor)* | — | — |

Não marque: localização, contatos, fotos, identificadores do dispositivo, histórico de apps, dados de uso/diagnóstico (o app não coleta).

## Permissões declaradas no app

| Permissão | Motivo |
|---|---|
| Notificações | Lembretes de vencimento |
| Calendário (leitura/escrita) | Criar eventos das contas no Google Agenda, quando o usuário ativa |
| Biometria | Desbloqueio por digital |
| Internet | Sincronização com a nuvem |

## Lançamento (conta pessoal nova)

1. **Teste fechado:** crie a faixa "Teste fechado", envie o `app-release.aab` da última release e adicione **12 ou mais testadores** (e-mails de contas Google).
2. Os testadores entram pelo link de participação e **mantêm o app instalado por 14 dias**.
3. Depois disso, peça o **acesso à produção** na Play Console (há um pequeno questionário sobre o teste).
4. Envie para **Produção**. A revisão costuma levar de algumas horas a 7 dias.

Assinatura: na primeira publicação, aceite o **Play App Signing**. A chave em `android-signing/` passa a ser a "chave de upload". Todo AAB novo precisa ser assinado com ela (o CI já faz isso).
