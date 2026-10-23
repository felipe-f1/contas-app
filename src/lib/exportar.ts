import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import { hojeISO } from './datas';
import { listarTodosLancamentos } from './db';
import { gerarCSV } from './relatorios';

/** Gera a planilha com todos os lançamentos e abre o menu de compartilhar. */
export async function exportarPlanilha(db: SQLiteDatabase) {
  const csv = gerarCSV(await listarTodosLancamentos(db));
  const arquivo = new File(Paths.cache, `contas-${hojeISO()}.csv`);
  if (arquivo.exists) arquivo.delete();
  arquivo.create();
  await arquivo.write(csv);
  await Sharing.shareAsync(arquivo.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Exportar planilha',
  });
}
