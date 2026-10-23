// Valores são sempre inteiros em centavos: float não é confiável para dinheiro.

export function formatarBRL(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}R$ ${reais},${pad2(abs % 100)}`;
}

/** Máscara de digitação: "12345" → 12345 centavos (R$ 123,45). */
export function centavosDeDigitos(texto: string): number {
  const digitos = texto.replace(/\D/g, '').slice(0, 11);
  return digitos ? parseInt(digitos, 10) : 0;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
