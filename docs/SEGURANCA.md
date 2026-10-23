# Segurança do app Contas

## Camadas de proteção

| Ameaça | Proteção |
|---|---|
| Alguém pega o celular desbloqueado | PIN de 6 dígitos ou biometria ao abrir o app e depois de 1 minuto em segundo plano. Após 5 PINs errados, a conta é desconectada e os dados são apagados do aparelho |
| Alguém copia os arquivos do app (celular com root, perícia) | Banco local criptografado com **SQLCipher (AES-256)**. A chave de 256 bits é aleatória e fica no **Android Keystore** (iOS: Keychain), presa ao aparelho |
| Backup do Android extraindo os dados | `allowBackup=false` e regras que excluem o SecureStore do backup |
| Prints ou a tela de apps recentes mostrando valores | `FLAG_SECURE` (desativável em Ajustes); no iOS, uma cobertura ao ir para segundo plano |
| Interceptação na rede | Toda comunicação com o Supabase usa HTTPS/TLS |
| Outro usuário lendo seus dados no servidor | **Row Level Security** no Postgres: cada linha tem dono e as regras só liberam `auth.uid() = user_id`. Testado automaticamente a cada build (`npm run test:banco`) |
| Senha fraca ou vazada | Mínimo de 8 caracteres com letras e números, validado no app e no servidor; limite de tentativas do Supabase Auth |
| Roubo do token de sessão | Tokens guardados dentro do banco criptografado e renovados automaticamente; "Sair" apaga sessão, dados, notificações e eventos da agenda |
| HTML malicioso em descrições no e-mail semanal | Todo texto do usuário é escapado (coberto por teste) |
| APK falsificado como "atualização" | O APK é assinado com uma chave própria cuja senha fica só nos secrets do GitHub |

## Como os segredos são guardados

- **Senha da conta:** nunca fica no aparelho. Vai por HTTPS ao Supabase, que guarda apenas o hash (bcrypt).
- **PIN:** só o hash SHA-256 com sal aleatório, no SecureStore.
- **Chave do banco:** gerada com `getRandomBytes(32)` e guardada no SecureStore com `WHEN_UNLOCKED_THIS_DEVICE_ONLY`.

## Limites conhecidos

- **Celular com root ou malware com acesso de administrador** pode, em teoria, ler a memória do app enquanto ele está aberto. Nenhum app consegue se proteger disso por completo.
- **Dados no servidor** ficam criptografados em disco pelo Supabase (AES-256), mas não são criptografados ponta a ponta: quem administra o projeto Supabase consegue lê-los. Isso permite o e-mail semanal e futuras versões web. Proteja sua conta do Supabase com autenticação em dois fatores.
- **Repositório público:** o código é aberto (isso não expõe dados). A chave de assinatura no repositório é inútil sem a senha guardada no secret do GitHub.
