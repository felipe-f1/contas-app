/** Hash djb2: rápido e suficiente para detectar mudanças (não é criptográfico). */
export function hashTexto(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
