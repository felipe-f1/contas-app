// Assina o APK de release com a chave do app (android-signing/), cuja senha vem
// da variável ANDROID_KEYSTORE_PASSWORD (secret do GitHub). Sem a variável,
// o build local continua usando a chave de debug.
const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCO_RELEASE = `
        release {
            if (System.getenv('ANDROID_KEYSTORE_PASSWORD')) {
                storeFile file("$rootDir/../android-signing/contas-release.keystore")
                storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
                keyAlias 'contas'
                keyPassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes('contas-release.keystore')) return mod;

    gradle = gradle.replace(/signingConfigs \{/, (m) => `${m}${BLOCO_RELEASE}`);
    // Troca apenas o signingConfig dentro de buildTypes.release.
    gradle = gradle.replace(
      /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig System.getenv('ANDROID_KEYSTORE_PASSWORD') ? signingConfigs.release : signingConfigs.debug",
    );
    if (!gradle.includes('signingConfigs.release')) {
      throw new Error('withReleaseSigning: formato do build.gradle mudou; revise o plugin.');
    }
    mod.modResults.contents = gradle;
    return mod;
  });
};
