# Atualizações automáticas (sem baixar APK)

O app recebe sozinho as mudanças de telas e regras, pelo **EAS Update** do Expo (grátis para este porte). Ao abrir o app, ou ao voltar para ele, a versão nova é baixada e o app pergunta se pode reiniciar.

## Configurar (uma vez, ~5 minutos)

1. Crie uma conta grátis em **https://expo.dev/signup**.
2. Crie o projeto: **https://expo.dev** → **Create a project** → nome `contas-em-dia`. Na página do projeto, copie o **ID** (formato `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
3. Crie um token: **https://expo.dev/settings/access-tokens** → **Create token** → nome `github`. Copie o valor (aparece uma vez só).
4. No GitHub, em **Settings → Secrets and variables → Actions**:
   - aba **Secrets** → **New repository secret**: `EXPO_TOKEN` = o token do passo 3 (**nunca compartilhe**);
   - aba **Variables** → **New repository variable**: `EXPO_PROJECT_ID` = o ID do passo 2 (é público).
5. Em **Actions → APK Android → Run workflow**: gera o APK com as atualizações ligadas. **Instale esse APK por cima (é o último que precisa baixar manualmente).**

Em **Ajustes**, no fim da tela, aparece "atualizações automáticas ativas" e, depois da primeira atualização, a data em que ela chegou.

## Como funciona no dia a dia

| Mudança | Chega como |
|---|---|
| Telas, textos, regras, correções de bugs (JavaScript) | **Automática**: o workflow "Atualização automática do app" publica a cada envio |
| Módulo nativo novo, permissão, ícone, nome ou pacote | **APK novo**: o workflow bloqueia a atualização automática ("Conferir versão nativa") para não quebrar quem tem o APK antigo |

Ao fazer uma mudança nativa: aumente `VERSAO_NATIVA` em `app.config.js`, rode `npm run conferir:nativo -- --registrar` e faça commit. Quem tem o APK antigo continua funcionando, só deixa de receber atualizações até instalar o novo.
