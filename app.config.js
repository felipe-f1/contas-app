// Configuração dinâmica sobre o app.json: o CI passa APP_VERSION_CODE (número
// do build) para que cada versão nova seja aceita como atualização pelo
// Android e pela Play Store, e para a loja mostrar "1.0.<build>".
const build = Number(process.env.APP_VERSION_CODE ?? 1);

module.exports = ({ config }) => ({
  ...config,
  version: `1.0.${build}`,
  android: {
    ...config.android,
    versionCode: build,
  },
  plugins: [...config.plugins, './plugins/withReleaseSigning'],
});
