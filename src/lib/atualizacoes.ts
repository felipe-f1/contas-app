import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

let verificando = false;

/**
 * Procura atualização (EAS Update) e, se houver, baixa e oferece reiniciar.
 * Silencioso quando não há atualização, sem internet ou com o recurso desligado.
 */
export async function verificarAtualizacao() {
  if (!Updates.isEnabled || __DEV__ || verificando) return;
  verificando = true;
  try {
    const { isAvailable } = await Updates.checkForUpdateAsync();
    if (!isAvailable) return;
    // Se a abertura do app já tinha baixado (ON_LOAD), isNew vem false, mas a
    // versão nova continua esperando para ser aplicada: oferece reiniciar igual.
    await Updates.fetchUpdateAsync();
    Alert.alert('Atualização pronta', 'Uma nova versão do Contas em Dia foi baixada. Reiniciar agora para usar?', [
      { text: 'Depois', style: 'cancel' },
      { text: 'Reiniciar', onPress: () => Updates.reloadAsync().catch(() => {}) },
    ]);
  } catch {
    // Sem internet ou servidor fora: tenta de novo na próxima vez.
  } finally {
    verificando = false;
  }
}

/** Texto para os Ajustes: versão do APK e da última atualização recebida. */
export function descricaoVersao(versaoApp: string | undefined) {
  const base = `Versão ${versaoApp ?? '?'}`;
  if (!Updates.isEnabled) return base;
  if (Updates.isEmbeddedLaunch || !Updates.createdAt) return `${base} · atualizações automáticas ativas`;
  const d = Updates.createdAt;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${base} · atualizado em ${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
