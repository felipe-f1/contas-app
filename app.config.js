// Configuração dinâmica sobre o app.json.
//
// APP_VERSION_CODE (número do build no CI): cada APK novo é aceito como
// atualização pelo Android e pela Play Store, e a loja mostra "1.0.<build>".
//
// EXPO_PROJECT_ID: liga as atualizações automáticas (EAS Update). Sem ele, o app
// funciona normalmente, só sem receber atualizações pela internet.
//
// VERSAO_NATIVA: atualizações automáticas só chegam a APKs com a mesma versão
// nativa. Aumente este número sempre que mudar algo nativo (módulo novo com
// código nativo, plugin, permissão, ícone, nome do pacote): aí é preciso
// instalar um APK novo, e os APKs antigos deixam de receber atualizações.
const VERSAO_NATIVA = '1';
const CANAL = 'producao';

const build = Number(process.env.APP_VERSION_CODE ?? 1);
const projetoExpo = process.env.EXPO_PROJECT_ID;

module.exports = ({ config }) => ({
  ...config,
  // Conta do Expo dona do projeto (precisa bater com o dono do EXPO_PROJECT_ID).
  ...(projetoExpo ? { owner: process.env.EXPO_OWNER || 'felipededanos-team' } : {}),
  version: `1.0.${build}`,
  android: {
    ...config.android,
    versionCode: build,
  },
  runtimeVersion: VERSAO_NATIVA,
  updates: projetoExpo
    ? {
        url: `https://u.expo.dev/${projetoExpo}`,
        checkAutomatically: 'ON_LOAD',
        fallbackToCacheTimeout: 0,
        // Fora do EAS Build o canal precisa ir no cabeçalho.
        requestHeaders: { 'expo-channel-name': CANAL },
      }
    : { enabled: false },
  extra: {
    ...config.extra,
    ...(projetoExpo ? { eas: { projectId: projetoExpo } } : {}),
  },
  plugins: [...config.plugins, './plugins/withReleaseSigning'],
});
