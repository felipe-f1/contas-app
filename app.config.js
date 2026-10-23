// Configuração dinâmica sobre o app.json: o CI passa APP_VERSION_CODE (número
// do build) para que cada APK novo seja aceito como atualização pelo Android.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.APP_VERSION_CODE ?? 1),
  },
  plugins: [...config.plugins, './plugins/withReleaseSigning'],
});
