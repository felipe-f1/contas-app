// Trava de segurança das atualizações automáticas (EAS Update).
//
// Atualização automática só pode ir para APKs com a mesma parte nativa. Este
// script calcula a impressão digital nativa (@expo/fingerprint) e compara com a
// registrada para a VERSAO_NATIVA atual (app.config.js):
//   - igual: pode publicar;
//   - diferente: a parte nativa mudou e a VERSAO_NATIVA não foi aumentada → falha.
//
// Uso: node scripts/conferir-versao-nativa.mjs            (confere)
//      node scripts/conferir-versao-nativa.mjs --registrar (grava a impressão atual)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SourceSkips, createFingerprintAsync } = require('@expo/fingerprint');

const raiz = new URL('..', import.meta.url).pathname;
const arquivo = `${raiz}versao-nativa.json`;
const versaoNativa = readFileSync(`${raiz}app.config.js`, 'utf8').match(/const VERSAO_NATIVA = '([^']+)'/)[1];

// O resultado não pode depender do ambiente (CI x local).
delete process.env.EXPO_PROJECT_ID;
delete process.env.APP_VERSION_CODE;
// Scripts do package.json e .gitignore não afetam o nativo: ignorados para não dar alarme falso.
const { hash } = await createFingerprintAsync(raiz, {
  sourceSkips: SourceSkips.PackageJsonScriptsAll | SourceSkips.GitIgnore,
});

if (process.argv.includes('--registrar')) {
  writeFileSync(arquivo, JSON.stringify({ versaoNativa, impressaoNativa: hash }, null, 2) + '\n');
  console.log(`Registrado: versão nativa ${versaoNativa} = ${hash}`);
  process.exit(0);
}

const registrado = JSON.parse(readFileSync(arquivo, 'utf8'));
if (registrado.versaoNativa === versaoNativa && registrado.impressaoNativa === hash) {
  console.log(`✓ Parte nativa inalterada (versão nativa ${versaoNativa}). Atualização automática liberada.`);
} else if (registrado.versaoNativa !== versaoNativa) {
  console.error(`✗ VERSAO_NATIVA mudou (${registrado.versaoNativa} → ${versaoNativa}). Rode com --registrar e faça commit.`);
  process.exit(1);
} else {
  console.error(
    `✗ A parte nativa mudou (${registrado.impressaoNativa} → ${hash}) mas a VERSAO_NATIVA continua ${versaoNativa}.\n` +
      '  Aumente VERSAO_NATIVA em app.config.js, rode com --registrar e faça commit.\n' +
      '  Os usuários precisarão instalar o APK novo; a atualização automática foi bloqueada para não quebrar o app.',
  );
  process.exit(1);
}
