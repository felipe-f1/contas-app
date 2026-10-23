// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/functions/**/index.ts', 'docs/vendor/**'],
  },
  {
    // O TypeScript já valida imports; este rule não segue cadeias de `export *`.
    rules: { 'import/namespace': 'off' },
  },
]);
