// Segredos do aparelho. Tudo aqui vai para o SecureStore, que no Android usa o
// Keystore (chave presa ao hardware) e no iOS o Keychain.
import { File } from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { defaultDatabaseDirectory, deleteDatabaseAsync, openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';

export const NOME_BANCO = 'contas-cifrado.db';
const NOME_BANCO_ANTIGO = 'contas.db'; // v1.0.5, sem criptografia

const OPCOES: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const CHAVE_BANCO = 'chave-banco-v1';
const CHAVE_PIN = 'pin-v1';

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

// ---------------------------------------------------------------------------
// Banco criptografado (SQLCipher, AES-256)
// ---------------------------------------------------------------------------
async function chaveDoBanco(): Promise<string> {
  let chave = await SecureStore.getItemAsync(CHAVE_BANCO, OPCOES);
  if (!chave) {
    chave = hex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(CHAVE_BANCO, chave, OPCOES);
  }
  return chave;
}

/** Primeira instrução obrigatória em toda conexão: sem ela o SQLCipher não lê nada. */
export async function destrancarBanco(db: SQLiteDatabase) {
  const chave = await chaveDoBanco();
  // Chave "crua" de 256 bits em hex: o SQLCipher pula a derivação de senha (mais rápido).
  await db.execAsync(`PRAGMA key = "x'${chave}'"`);
  await db.getFirstAsync('SELECT count(*) FROM sqlite_master'); // falha aqui se a chave estiver errada
}

/**
 * Quem instalou a v1.0.5 tem um banco sem criptografia. Copiamos tudo para o
 * banco cifrado com sqlcipher_export e apagamos o antigo. Roda uma única vez.
 */
export async function migrarBancoSemCriptografia() {
  // defaultDatabaseDirectory é um caminho puro ("/data/.../SQLite"); o File quer URI.
  const pasta: string = defaultDatabaseDirectory;
  const antigo = new File(`file://${pasta}/${NOME_BANCO_ANTIGO}`);
  if (!antigo.exists) return;

  const destino = new File(`file://${pasta}/${NOME_BANCO}`);
  if (destino.exists) destino.delete(); // sobra de uma tentativa interrompida

  const chave = await chaveDoBanco();
  const db = await openDatabaseAsync(NOME_BANCO_ANTIGO);
  const versao = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  await db.execAsync(`
    ATTACH DATABASE '${pasta}/${NOME_BANCO}' AS cifrado KEY "x'${chave}'";
    SELECT sqlcipher_export('cifrado');
    PRAGMA cifrado.user_version = ${versao};
    DETACH DATABASE cifrado;
  `);
  await db.closeAsync();
  await deleteDatabaseAsync(NOME_BANCO_ANTIGO);
  // A v1.0.5 guardava a sessão do login por código num armazenamento sem criptografia.
  await Storage.clearAsync().catch(() => {});
}

// ---------------------------------------------------------------------------
// PIN do bloqueio: guardamos só o hash SHA-256 com sal, nunca o PIN.
// ---------------------------------------------------------------------------
async function hashPin(pin: string, sal: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${sal}:${pin}`);
}

export async function definirPin(pin: string) {
  const sal = hex(Crypto.getRandomBytes(16));
  await SecureStore.setItemAsync(CHAVE_PIN, JSON.stringify({ sal, hash: await hashPin(pin, sal) }), OPCOES);
}

export async function temPin() {
  return (await SecureStore.getItemAsync(CHAVE_PIN, OPCOES)) != null;
}

export async function conferirPin(pin: string) {
  const salvo = await SecureStore.getItemAsync(CHAVE_PIN, OPCOES);
  if (!salvo) return false;
  const { sal, hash } = JSON.parse(salvo) as { sal: string; hash: string };
  return (await hashPin(pin, sal)) === hash;
}

export async function apagarPin() {
  await SecureStore.deleteItemAsync(CHAVE_PIN, OPCOES);
}
